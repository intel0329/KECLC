import ezdxf

def scan_template(filename):
    try:
        doc = ezdxf.readfile(filename)
        msp = doc.modelspace()
        print(f"--- Scan Result for {filename} ---")
        for insert in msp.query('INSERT'):
            print(f"Block: {insert.dxf.name} | Position: {insert.dxf.insert}")
            for attrib in insert.attribs:
                print(f"  Attrib: {attrib.dxf.tag} = {attrib.dxf.text}")
    except Exception as e:
        print(f"Error: {e}")

scan_template('public/3p4w_base_template.dxf')
