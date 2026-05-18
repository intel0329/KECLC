import ezdxf

def scan_red_entities(filename):
    try:
        doc = ezdxf.readfile(filename)
        msp = doc.modelspace()
        print(f"--- Red Entity Scan for {filename} ---")
        # 빨간색(1) 개체들을 모두 찾습니다.
        for entity in msp.query('*[color==1]'):
            print(f"Type: {entity.dxftype()} | Layer: {entity.dxf.layer}")
            if entity.dxftype() == 'LINE':
                print(f"  Start: {entity.dxf.start} | End: {entity.dxf.end}")
            elif entity.dxftype() == 'LWPOLYLINE':
                print(f"  Points: {[p for p in entity.get_points()]}")
    except Exception as e:
        print(f"Error: {e}")

scan_red_entities('public/3p4w_base_template.dxf')
