import sys
import json
import os
import ezdxf

def get_block_info(p_value):
    p = str(p_value)
    if p == '2': return "1P2W", 450
    if p == '3': return "3P3W", 600
    return "3P4W", 600

def clean_name(name):
    if not name: return ""
    s = str(name).strip()
    if s.endswith('PL'): s = s[:-2].strip()
    if s.endswith('"PL'): s = s[:-3].strip()
    if s.startswith('"') and s.endswith('"'): s = s[1:-1]
    return s

def get_pnl_materials(pnl_name, mount):
    name, m = str(pnl_name or ""), str(mount or "")
    door, box = "STEEL", "STEEL"
    if "매입" in m: door, box = "SUS", "STEEL"
    elif "노출" in m:
        if any(word in name for word in ["정육", "수산", "농산", "로컬", "식당"]): door, box = "SUS", "SUS"
        else: door, box = "STEEL", "STEEL"
    elif "방우" in m: door, box = "ALL SUS", "ALL SUS"
    return door, box

def generate_dxf(data):
    project_info = data.get('projectInfo', {})
    left_circuits = data.get('leftCircuits', [])
    right_circuits = data.get('rightCircuits', [])
    main_phase = project_info.get('phase', '3Ø-4W')
    
    suffix = ""
    if "1Ø" in main_phase: suffix = "_1"
    elif "3Ø-3W" in main_phase or "3Ø3W" in main_phase: suffix = "_3"
    elif "3Ø-4W" in main_phase or "3Ø4W" in main_phase: suffix = "_4"
    
    template_map = {
        '1Ø-2W': '1p2w_base_template.dxf', '1Ø2W': '1p2w_base_template.dxf',
        '3Ø-3W': '3p3w_base_template.dxf', '3Ø3W': '3p3w_base_template.dxf',
        '3Ø-4W': '3p4w_base_template.dxf', '3Ø4W': '3p4w_base_template.dxf'
    }
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, '..', '..', '..'))
    template_path = os.path.join(project_root, 'public', template_map.get(main_phase, '3p4w_base_template.dxf'))
    
    try:
        doc = ezdxf.readfile(template_path)
    except Exception: return None
    msp = doc.modelspace()

    # --- 1. 좌표 감지 (중복 감지 방지) ---
    base_coords = {
        'PANEL_NAME': (149296.48, 59478.03),
        'MAIN_BREAKER': (153346.48, 57303.03),
        'BRANCH_START': 56028.03,
        'LEFT_X': 153346.48,
        'RIGHT_X': 153345.22
    }
    
    found = {'PNL': False, 'MAIN': False, 'LEFT': False, 'RIGHT': False}
    to_delete = []
    
    for insert in msp.query('INSERT'):
        name = insert.dxf.name
        pos = insert.dxf.insert
        if name == 'PANEL_NAME' and not found['PNL']:
            base_coords['PANEL_NAME'] = (pos.x, pos.y)
            found['PNL'] = True
        elif name.startswith('MAIN_BREAKER') and not found['MAIN']:
            base_coords['MAIN_BREAKER'] = (pos.x, pos.y)
            found['MAIN'] = True
        elif 'LEFT_BRANCH_BREAKER' in name:
            # 발견된 블록 중 가장 높은 위치(Y값)를 시작점으로 사용
            if not found['LEFT'] or pos.y > base_coords['BRANCH_START']:
                base_coords['BRANCH_START'] = pos.y
                base_coords['LEFT_X'] = pos.x
                found['LEFT'] = True
        elif 'RIGHT_BRANCH_BREAKER' in name:
            if not found['RIGHT'] or pos.x != base_coords['RIGHT_X']:
                base_coords['RIGHT_X'] = pos.x
                found['RIGHT'] = True
            
        # 모든 샘플 블록은 일단 삭제 리스트에 추가
        if name == 'PANEL_NAME' or name.startswith('MAIN_BREAKER') or 'BRANCH_BREAKER' in name:
            to_delete.append(insert)
    
    for ent in to_delete: msp.delete_entity(ent)
    for ent in msp.query('*[layer=="Defpoints"]'): msp.delete_entity(ent)

    # 데이터 준비
    pnl_name = project_info.get('panelName', '')
    mount = project_info.get('installType', '노출')
    door_mat, box_mat = get_pnl_materials(pnl_name, mount)

    # --- 2. 배치 (동기화된 행 기반 루프) ---
    msp.add_blockref('PANEL_NAME', base_coords['PANEL_NAME']).add_auto_attribs({
        'PNL_NAME': str(pnl_name), 'PNL_MOUNT': str(mount),
        'PNL_DOOR': door_mat, 'PNL_BOX': box_mat
    })
    
    main_blk = f"MAIN_BREAKER{suffix}"
    if main_blk not in doc.blocks: main_blk = "MAIN_BREAKER"
    msp.add_blockref(main_blk, base_coords['MAIN_BREAKER']).add_auto_attribs({
        'SOURCE': str(project_info.get('sourceName', '')),
        'PNL_NAME': str(pnl_name), 'CB_TYPE': str(project_info.get('mainBreakerType', 'MCCB')),
        'AF': str(project_info.get('mccbAF', '')), 'AT': str(project_info.get('mccbAT', ''))
    })
    
    # --- 0. 기존에 모델 공간에 남아있는 유령 접점(BUS_CONN_DOT) 자동 삭제 ---
    for entity in msp.query('INSERT[name=="BUS_CONN_DOT"]'):
        msp.delete_entity(entity)

    # --- 3. 레이어 기반 버스바(Busbar) 위치 감지 ---
    def get_phase_map(msp):
        mapping = {}
        layer_names = {'L1': 'BUS_L1', 'L2': 'BUS_L2', 'L3': 'BUS_L3', 'N': 'BUS_N'}
        for phase, layer in layer_names.items():
            entities = msp.query(f'*[layer=="{layer}"]')
            if entities:
                ent = entities[0]
                if ent.dxftype() == 'LINE': mapping[phase] = ent.dxf.start.x
                elif ent.dxftype() == 'LWPOLYLINE': mapping[phase] = list(ent.get_points())[0][0]
        if not mapping:
            v_lines = []
            for line in msp.query('LINE[layer=="1"]'):
                s, e = line.dxf.start, line.dxf.end
                if abs(s.x - e.x) < 0.5 and abs(s.y - e.y) > 1000: v_lines.append(s.x)
            v_lines = sorted(list(set(v_lines)))
            if len(v_lines) >= 4: mapping = {'L1': v_lines[0], 'L2': v_lines[1], 'L3': v_lines[2], 'N': v_lines[3]}
            elif len(v_lines) == 3: mapping = {'L1': v_lines[0], 'L2': v_lines[1], 'L3': v_lines[2]}
            elif len(v_lines) == 2: mapping = {'L1': v_lines[0], 'N': v_lines[1]}
        return mapping

    phase_map = get_phase_map(msp)

    # --- [수정] 동기화된 배치 로직 시작 ---
    GAP = 300
    curr_y = base_coords['BRANCH_START']
    max_rows = max(len(left_circuits), len(right_circuits))
    
    # 일괄소등 사전 탐색
    remote_row_idx = -1
    remote_side = None
    for i in range(max_rows):
        l_circ = left_circuits[i] if i < len(left_circuits) else {}
        r_circ = right_circuits[i] if i < len(right_circuits) else {}
        if any(l.get('prefix') == '일괄소등' for l in l_circ.get('loads', [])):
            remote_row_idx, remote_side = i, "LEFT"
            break
        if any(l.get('prefix') == '일괄소등' for l in r_circ.get('loads', [])):
            remote_row_idx, remote_side = i, "RIGHT"
            break
    global_remote_placed = False

    prefix_type_map = {'감전보호': 'ELB', 'On/Off': 'ONOFF', '타이머': 'TIMER'}

    for i in range(max_rows):
        l_circ = left_circuits[i] if i < len(left_circuits) else None
        r_circ = right_circuits[i] if i < len(right_circuits) else None
        
        # 이번 행의 최대 높이 계산
        l_h = get_block_info(l_circ.get('p', 4))[1] if l_circ else 0
        r_h = get_block_info(r_circ.get('p', 4))[1] if r_circ else 0
        row_max_h = max(l_h, r_h) or 600 # 최소 600 기본값
        
        # 일괄소등 처리
        if i == remote_row_idx:
            curr_y -= (row_max_h + GAP)
            if not global_remote_placed:
                side_for_remote = remote_side or "LEFT"
                x_for_remote = base_coords['LEFT_X'] if side_for_remote == "LEFT" else base_coords['RIGHT_X']
                sym_blk = f"1P2W_{side_for_remote}_SYM_REMOTE{suffix}"
                if sym_blk not in doc.blocks: sym_blk = f"1P2W_{side_for_remote}_SYM_REMOTE"
                if sym_blk in doc.blocks:
                    msp.add_blockref(sym_blk, (x_for_remote, curr_y))
                    global_remote_placed = True

        # 좌/우 배치
        for side, circ, x_coord in [('LEFT', l_circ, base_coords['LEFT_X']), ('RIGHT', r_circ, base_coords['RIGHT_X'])]:
            if not circ: continue
            
            p_val = circ.get('p', 4)
            prefix, block_h = get_block_info(p_val)
            b_name = f"{prefix}_{side}_BRANCH_BREAKER{suffix}"
            if b_name not in doc.blocks: b_name = f"{prefix}_{side}_BRANCH_BREAKER"
            
            if b_name in doc.blocks:
                val = clean_name(circ.get('loadName') or circ.get('circuitNo', ''))
                msp.add_blockref(b_name, (x_coord, curr_y)).add_auto_attribs({
                    'CIR_NO': val, 'CB_TYPE': str(circ.get('type', 'MCCB')),
                    'AF': str(circ.get('af', '')), 'AT': str(circ.get('at', ''))
                })
                
                # 심벌 배치
                processed_prefixes = set()
                for load in circ.get('loads', []):
                    p_text = load.get('prefix')
                    if p_text in prefix_type_map and p_text not in processed_prefixes:
                        type_name = prefix_type_map[p_text]
                        p_p = int(p_val) if p_val is not None else 4
                        p_pfx_inner = "1P2W" if p_p == 2 else ("3P3W" if p_p == 3 else "3P4W")
                        s_pfx_inner = "L" if side == "LEFT" else "R"
                        sym_blk = f"{p_pfx_inner}_{s_pfx_inner}_SYM_{type_name}{suffix}"
                        if sym_blk not in doc.blocks: sym_blk = f"{p_pfx_inner}_{s_pfx_inner}_SYM_{type_name}"
                        if sym_blk in doc.blocks: msp.add_blockref(sym_blk, (x_coord, curr_y))
                        elif f"SYM_{type_name}" in doc.blocks: msp.add_blockref(f"SYM_{type_name}", (x_coord, curr_y))
                        processed_prefixes.add(p_text)
                
                # 접점 배치
                p_val_int = int(p_val) if str(p_val).isdigit() else 0
                if 'BUS_CONN_DOT' in doc.blocks and p_val_int == 2:
                    pl = circ.get('phaseLine', 'L1')
                    is_1p2w_panel = project_info.get('phase') == '1Ø-2W'
                    if is_1p2w_panel or (pl not in phase_map and pl != 'N'):
                        for p_key in ['L1', 'L2', 'L3']:
                            if p_key in phase_map: pl = p_key; break
                    for ph in [pl, 'N']:
                        if ph in phase_map:
                            y_offset = -150 if ph == 'N' else 0
                            msp.add_blockref('BUS_CONN_DOT', (phase_map[ph], curr_y + y_offset))

        curr_y -= (row_max_h + GAP)
    
    last_y_l, last_y_r = curr_y, curr_y # 동기화되었으므로 동일
            
    # --- 3. 자동 연장/축소 (버스바 및 외함선) ---
    min_circuit_y = min(last_y_l, last_y_r)
    target_bottom_y = min(min_circuit_y - 600, base_coords['BRANCH_START'] - 1200)
    
    # 새로 만든 버스바 레이어 목록
    busbar_layers = ['BUS_L1', 'BUS_L2', 'BUS_L3', 'BUS_N']

    for entity in msp.query('LWPOLYLINE'):
        # 기존 레이어 '5'나 색상 2뿐만 아니라 새로운 버스바 레이어도 포함
        if entity.dxf.layer in busbar_layers or entity.dxf.color == 2 or entity.dxf.layer == '5':
            points = [(p[0], target_bottom_y if p[1] < base_coords['BRANCH_START'] else p[1]) for p in entity.get_points()]
            entity.set_points(points)

    for entity in msp.query('LINE'):
        # 기존 레이어 '1'이나 색상 1, 2뿐만 아니라 새로운 버스바 레이어도 포함
        if entity.dxf.layer in busbar_layers or entity.dxf.layer == '1' or entity.dxf.color == 1 or entity.dxf.color == 2:
            start, end = entity.dxf.start, entity.dxf.end
            if abs(start[0] - end[0]) < 10.0: # 수직선만 연장
                s_y = target_bottom_y + 150 if start[1] < base_coords['BRANCH_START'] else start[1]
                e_y = target_bottom_y + 150 if end[1] < base_coords['BRANCH_START'] else end[1]
                entity.dxf.start = (start[0], s_y)
                entity.dxf.end = (end[0], e_y)

    for insert in msp.query('INSERT[name=="earth-panel"]'):
        insert.dxf.insert = (insert.dxf.insert.x, target_bottom_y + 150, insert.dxf.insert.z)

    output_filename = f"temp_{os.getpid()}.dxf"
    relative_path = os.path.join('src', 'utils', 'cad', output_filename)
    absolute_path = os.path.join(project_root, relative_path)
    doc.saveas(absolute_path)
    return relative_path

if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(1)
    with open(sys.argv[1], 'r', encoding='utf-8') as f: data = json.load(f)
    res = generate_dxf(data)
    if res: print(res)
