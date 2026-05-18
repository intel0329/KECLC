import ezdxf
import os

def check_busbars(filename):
    if not os.path.exists(filename):
        print(f"File {filename} not found")
        return
    doc = ezdxf.readfile(filename)
    msp = doc.modelspace()
    v_lines = []
    for line in msp.query('LINE'):
        s, e = line.dxf.start, line.dxf.end
        if abs(s.x - e.x) < 0.5:
            length = abs(s.y - e.y)
            if length > 1000:
                v_lines.append((s.x, length, line.dxf.layer))
    
    for poly in msp.query('LWPOLYLINE'):
        pts = list(poly.get_points())
        for i in range(len(pts)-1):
            p1, p2 = pts[i], pts[i+1]
            if abs(p1[0] - p2[0]) < 0.5:
                length = abs(p1[1] - p2[1])
                if length > 1000:
                    v_lines.append((p1[0], length, poly.dxf.layer))
    
    print(f"--- Busbar Scan for {filename} ---")
    v_lines.sort(key=lambda x: x[0])
    for x, l, layer in v_lines:
        print(f"X={x:.2f}, Length={l:.2f}, Layer={layer}")
    
    if 'BUS_CONN_DOT' in doc.blocks:
        print(f"Block BUS_CONN_DOT EXISTS")
    else:
        print(f"Block BUS_CONN_DOT MISSING")

if __name__ == "__main__":
    check_busbars('public/1p2w_base_template.dxf')
    check_busbars('public/3p3w_base_template.dxf')
    check_busbars('public/3p4w_base_template.dxf')
