import ezdxf

def scan_layers_and_entities(filename):
    try:
        doc = ezdxf.readfile(filename)
        msp = doc.modelspace()
        
        red_layers = []
        for layer in doc.layers:
            if layer.dxf.color == 1:
                red_layers.append(layer.dxf.name)
        
        print(f"Red Layers: {red_layers}")
        
        for entity in msp:
            # 개체 색상이 1이거나, 색상이 ByLayer인데 해당 레이어가 빨간색인 경우
            if entity.dxf.color == 1 or (entity.dxf.color == 256 and entity.dxf.layer in red_layers):
                print(f"Type: {entity.dxftype()} | Layer: {entity.dxf.layer} | Color: {entity.dxf.color}")
                if entity.dxftype() == 'LINE':
                    print(f"  Start: {entity.dxf.start} | End: {entity.dxf.end}")
                elif entity.dxftype() == 'LWPOLYLINE':
                    print(f"  Points: {[p for p in entity.get_points()]}")

    except Exception as e:
        print(f"Error: {e}")

scan_layers_and_entities('public/3p4w_base_template.dxf')
