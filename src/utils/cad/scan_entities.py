import ezdxf

def scan_entities(filename):
    try:
        doc = ezdxf.readfile(filename)
        msp = doc.modelspace()
        print(f"--- Entity Scan for {filename} ---")
        # 모든 선형 개체(LINE, POLYLINE, LWPOLYLINE)를 조사합니다.
        for entity in msp.query('LINE LWPOLYLINE POLYLINE'):
            # 노란색(2)이거나 테두리로 의심되는 레이어 확인
            if entity.dxf.color == 2 or "Outer" in entity.dxf.layer or "Frame" in entity.dxf.layer:
                print(f"Type: {entity.dxftype()} | Layer: {entity.dxf.layer} | Color: {entity.dxf.color}")
                if entity.dxftype() == 'LINE':
                    print(f"  Start: {entity.dxf.start} | End: {entity.dxf.end}")
                elif entity.dxftype() == 'LWPOLYLINE':
                    print(f"  Points: {[p for p in entity.get_points()]}")
    except Exception as e:
        print(f"Error: {e}")

scan_entities('public/3p4w_base_template.dxf')
