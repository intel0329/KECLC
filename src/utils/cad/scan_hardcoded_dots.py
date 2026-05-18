import ezdxf
import os

templates = [
    'public/1p2w_base_template.dxf',
    'public/3p3w_base_template.dxf',
    'public/3p4w_base_template.dxf'
]

for f in templates:
    if not os.path.exists(f): continue
    doc = ezdxf.readfile(f)
    msp = doc.modelspace()
    dots = [i for i in msp.query('INSERT') if i.dxf.name == 'BUS_CONN_DOT']
    if dots:
        print(f"--- Hardcoded dots in {f} ---")
        for d in dots:
            print(f"  Pos: {d.dxf.insert}")
    else:
        print(f"No hardcoded dots in {f}")
