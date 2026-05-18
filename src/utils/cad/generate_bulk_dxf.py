import ezdxf
from ezdxf.addons.importer import Importer
from ezdxf.math import Matrix44
import json
import sys
import os
from datetime import datetime

def generate_bulk_dxf(json_path):
    print(f"Processing JSON: {json_path}")
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            bulk_data = json.load(f)
            
        panels = bulk_data.get('panels', [])
        if not panels:
            print("Error: No panels found in JSON")
            return

        # Create a master document
        # We'll use the first panel's template as the base for the master document to get the correct headers/styles
        first_panel = panels[0]['data']
        first_phase = first_panel['projectInfo'].get('phase', '3Ø-4W')
        
        if first_phase == '1Ø-2W':
            base_template = 'public/1p2w_base_template.dxf'
        elif first_phase == '3Ø-3W':
            base_template = 'public/3p3w_base_template.dxf'
        else:
            base_template = 'public/3p4w_base_template.dxf'
            
        if not os.path.exists(base_template):
            # Fallback to a generic one if specific not found
            base_template = 'public/3p4w_base_template.dxf'

        master_doc = ezdxf.readfile(base_template)
        # Clear modelspace of the master doc because we will import each panel including the first one
        # so that they all have the same offset logic.
        for entity in master_doc.modelspace():
            master_doc.modelspace().delete_entity(entity)

        x_offset = 0
        PANEL_SPACING = 15000 # Increased spacing to prevent overlap

        for idx, panel_entry in enumerate(panels):
            panel_data = panel_entry['data']
            pnl_name = panel_data.get('projectInfo', {}).get('panelName', 'Unnamed')
            print(f"Exporting Panel [{idx}]: {pnl_name} at X={x_offset}")
            
            # 1. Load the template for this specific panel
            phase = panel_data['projectInfo'].get('phase', '3Ø-4W')
            suffix = ''
            if phase == '1Ø-2W':
                tpl_path = 'public/1p2w_base_template.dxf'
                suffix = '_1'
            elif phase == '3Ø-3W':
                tpl_path = 'public/3p3w_base_template.dxf'
                suffix = '_3'
            else:
                tpl_path = 'public/3p4w_base_template.dxf'
                suffix = ''
                
            if not os.path.exists(tpl_path):
                tpl_path = 'public/3p4w_base_template.dxf'
            
            source_doc = ezdxf.readfile(tpl_path)
            
            # 2. Process the source_doc (Fill data) BEFORE importing
            # This allows us to use the existing filling logic on the source_doc
            # Note: We need a simplified version of the filling logic here
            fill_panel_data(source_doc, panel_data, suffix)
            
            # 3. Import everything from processed source_doc into master_doc
            importer = Importer(source_doc, master_doc)
            
            # Import all blocks first to ensure nested references are resolved
            block_names = [b.name for b in source_doc.blocks if not b.name.startswith('*')]
            importer.import_blocks(block_names)
            
            # Import all entities from modelspace with offset
            # We use a custom function to import and move entities
            import_entities_with_offset(source_doc.modelspace(), master_doc.modelspace(), importer, (x_offset, 0))
            
            importer.finalize()
            
            # Update offset for next panel
            x_offset += PANEL_SPACING

        # Save the result
        output_dir = 'temp'
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        filename = f"bulk_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{os.getpid()}.dxf"
        output_path = os.path.join(output_dir, filename)
        master_doc.saveas(output_path)
        
        # Print only the relative path for PHP to pick up
        print(output_path.replace('\\', '/'))

    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()

def import_entities_with_offset(source_msp, target_msp, importer, offset):
    from ezdxf.math import Matrix44
    dx, dy = offset
    if dx == 0 and dy == 0:
        # No movement needed for the first panel
        for entity in source_msp:
            try:
                importer.import_entity(entity, target_layout=target_msp)
            except:
                pass
        return

    matrix = Matrix44.translate(dx, dy, 0)
    
    # 1. First, move ALL entities in the source modelspace
    # This is safe because source_doc is local to this panel's iteration
    for entity in source_msp:
        try:
            entity.transform(matrix)
            # Special handling for Attributes of an INSERT
            if entity.dxftype() == 'INSERT':
                for attrib in entity.attribs:
                    attrib.transform(matrix)
        except:
            pass
            
    # 2. Now import the ALREADY MOVED entities into the master doc
    for entity in source_msp:
        try:
            importer.import_entity(entity, target_layout=target_msp)
        except Exception as e:
            print(f"Entity import warning: {str(e)}")

def fill_panel_data(doc, data, suffix):
    """
    Simplified version of the logic in generate_dxf.py
    """
    msp = doc.modelspace()
    project_info = data.get('projectInfo', {})
    left_circuits = data.get('leftCircuits', [])
    right_circuits = data.get('rightCircuits', [])
    
    # 1. Detect coordinates
    base_coords = {
        'PANEL_NAME': (0, 0),
        'MAIN_BREAKER': (0, 0),
        'BRANCH_START': 0,
        'LEFT_X': 0,
        'RIGHT_X': 0
    }
    found = {'PNL': False, 'MAIN': False, 'LEFT': False, 'RIGHT': False}
    delete_list = []

    for entity in msp.query('INSERT'):
        name = entity.dxf.name
        pos = entity.dxf.insert
        if name == 'PANEL_NAME':
            base_coords['PANEL_NAME'] = (pos.x, pos.y)
            found['PNL'] = True
        elif name.startswith('MAIN_BREAKER') and not found['MAIN']:
            base_coords['MAIN_BREAKER'] = (pos.x, pos.y)
            found['MAIN'] = True
        elif 'LEFT_BRANCH_BREAKER' in name:
            if not found['LEFT'] or pos.y > base_coords['BRANCH_START']:
                base_coords['BRANCH_START'] = pos.y
                base_coords['LEFT_X'] = pos.x
                found['LEFT'] = True
        elif 'RIGHT_BRANCH_BREAKER' in name:
            if not found['RIGHT'] or pos.x != base_coords['RIGHT_X']:
                base_coords['RIGHT_X'] = pos.x
                found['RIGHT'] = True
                
        if name == 'PANEL_NAME' or name.startswith('MAIN_BREAKER') or 'BRANCH_BREAKER' in name:
            delete_list.append(entity)

    for e in delete_list:
        msp.delete_entity(e)

    # 2. Place Main Info
    pnl_name = project_info.get('panelName', 'Untitled')
    # Material Logic (Reserved from user manual edit)
    def get_pnl_materials(name):
        if any(keyword in name for keyword in ["로컬", "식당", "SUS", "sus", "Sus"]):
            return "SUS", "SUS"
        return "STEEL", "STEEL"
    
    door_mat, box_mat = get_pnl_materials(pnl_name)
    
    if 'PANEL_NAME' in msp.doc.blocks:
        msp.add_blockref('PANEL_NAME', base_coords['PANEL_NAME']).add_auto_attribs({
            'PNL_NAME': pnl_name,
            'DOOR': door_mat,
            'BOX': box_mat
        })

    main_af = str(project_info.get('mccbAF', '100'))
    main_at = str(project_info.get('mccbAT', '50'))
    main_phase = project_info.get('phase', '3Ø-4W')
    main_volt = "380/220V" if main_phase == '3Ø-4W' else "220V"
    
    main_block = 'MAIN_BREAKER' + suffix
    if main_block not in msp.doc.blocks:
        main_block = 'MAIN_BREAKER'
        
    if main_block in msp.doc.blocks:
        msp.add_blockref(main_block, base_coords['MAIN_BREAKER']).add_auto_attribs({
            'PHASE': f"{main_phase} {main_volt}",
            'PNL_NAME': pnl_name,
            'AF': main_af,
            'AT': main_at
        })

    # 3. Place Circuits
    GAP = 300
    block_h = 600 # 3P default
    if suffix == '_1': block_h = 450
    
    # Pre-scan for Remote
    remote_row_idx = -1
    remote_side = 'LEFT'
    for c in left_circuits + right_circuits:
        if any(kw in str(c.get('material', '')) for kw in ['일괄소등', 'Remote', 'REMOTE']):
            try:
                remote_row_idx = int(c.get('row', 0))
            except:
                remote_row_idx = -1
            remote_side = 'LEFT' if c in left_circuits else 'RIGHT'
            break

    # Branch Logic Loop
    def safe_int(val, default=0):
        try:
            return int(val)
        except:
            return default

    max_row = 0
    if left_circuits: max_row = max(max_row, max(safe_int(c.get('row')) for c in left_circuits))
    if right_circuits: max_row = max(max_row, max(safe_int(c.get('row')) for c in right_circuits))

    remote_placed = False

    for row in range(1, max_row + 1):
        curr_y = base_coords['BRANCH_START'] - (row - 1) * (block_h + GAP)
        
        # Current circuits for this row
        l_cir = next((c for c in left_circuits if safe_int(c.get('row')) == row), None)
        r_cir = next((c for c in right_circuits if safe_int(c.get('row')) == row), None)
        
        if not l_cir and not r_cir:
            continue # Skip empty rows if any
            
        if remote_row_idx != -1 and row > remote_row_idx:
            curr_y -= (block_h + GAP)

        # Left
        l_cir = next((c for c in left_circuits if int(c.get('row', 0)) == row), None)
        if l_cir:
            place_circuit(msp, l_cir, base_coords['LEFT_X'], curr_y, 'LEFT', suffix)
        
        # Right
        r_cir = next((c for c in right_circuits if int(c.get('row', 0)) == row), None)
        if r_cir:
            place_circuit(msp, r_cir, base_coords['RIGHT_X'], curr_y, 'RIGHT', suffix)

        # Global Remote (Once per panel)
        if row == remote_row_idx and not remote_placed:
            remote_y = base_coords['BRANCH_START'] - row * (block_h + GAP)
            # Remote always uses 1P2W block
            remote_block = f"1P2W_{remote_side}_SYM_REMOTE{suffix}"
            if remote_block not in msp.doc.blocks:
                remote_block = f"1P2W_{remote_side}_SYM_REMOTE"
                
            if remote_block in msp.doc.blocks:
                msp.add_blockref(remote_block, (base_coords['LEFT_X'] if remote_side == 'LEFT' else base_coords['RIGHT_X'], remote_y))
                remote_placed = True

def place_circuit(msp, cir, x, y, side_full, suffix):
    try:
        p = int(cir.get('p', 3))
    except (ValueError, TypeError):
        p = 3
    prefix = '3P3W' if p == 3 else '1P2W'
    block_name = f"{prefix}_{side_full}_BRANCH_BREAKER{suffix}"
    
    # Fallback for block name
    if block_name not in msp.doc.blocks:
        block_name = f"{prefix}_{side_full}_BRANCH_BREAKER"

    if block_name in msp.doc.blocks:
        attr = {
            'CIR_NO': str(cir.get('row', '')),
            'AF': str(cir.get('af', '50')),
            'AT': str(cir.get('at', '20')),
            'CB_TYPE': str(cir.get('cbType', 'MCCB')),
            'NAME': str(cir.get('name', ''))
        }
        msp.add_blockref(block_name, (x, y)).add_auto_attribs(attr)
    
    # Symbols (ELB, ONOFF, TIMER) - Use L/R for symbols
    side_short = 'L' if side_full == 'LEFT' else 'R'
    material = str(cir.get('material', ''))
    sym_map = {
        'ELB': ['누전', 'ELB', 'elb', '감전'],
        'ONOFF': ['온오프', 'On/Off', 'ON/OFF', '스위치', '접점'],
        'TIMER': ['타이머', 'Timer', 'TIMER']
    }
    
    for sym_type, keywords in sym_map.items():
        if any(kw in material for kw in keywords):
            sym_block = f"{prefix}_{side_short}_SYM_{sym_type}{suffix}"
            if sym_block not in msp.doc.blocks:
                sym_block = f"{prefix}_{side_short}_SYM_{sym_type}"
            
            if sym_block in msp.doc.blocks:
                msp.add_blockref(sym_block, (x, y))

if __name__ == '__main__':
    if len(sys.argv) > 1:
        generate_bulk_dxf(sys.argv[1])
    else:
        print("Usage: python generate_bulk_dxf.py <json_path>")
