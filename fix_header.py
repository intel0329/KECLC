
import os

file_path = r"c:/Users/intel/Videos/xampp/htdocs/KECLC/src/components/PanelFeederContent.jsx"

# Read file contents
with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Define anchors that are definitely present and surround the corrupted block
start_marker = 'subLabel="[KA]" className="min-w-[70px]" />'
end_marker = '<TableHeader colSpan={6}>CABLE SELECT</TableHeader>'

start_pos = content.find(start_marker)
end_pos = content.find(end_marker)

if start_pos == -1 or end_pos == -1:
    print(f"Error: Could not find markers in {file_path}")
    print(f"Start marker found: {start_pos != -1}")
    print(f"End marker found: {end_pos != -1}")
    exit(1)

# Calculate insertion points
# start_pos points to the start of the marker line. We want to keep that line.
# We need to find the newline AFTER the start marker.
insert_start = content.find('\n', start_pos) + 1

# end_pos points to the start of the end marker line. We want to start inserting BEFORE that line's indentation.
# Actually, just finding the last newline before end_pos is safer to preserve indentation logic, 
# or just slice up to end_pos and let the new content handle its own leading newline.
insert_end = content.rfind('\n', 0, end_pos) + 1 # Use rfind to get the start of the line containing end_marker

# The replacement content (indented correctly for the file structure)
replacement_content = """
                                    <TableHeader className="border-l-2 border-l-blue-900/50 min-w-[70px]">I<sub>B</sub></TableHeader>
                                    <TableHeader className="min-w-[70px]">I<sub>N</sub></TableHeader>
                                    <TableHeader className="text-[10px] min-w-[70px]">I<sub>B</sub> &lt; I<sub>N</sub> &lt; I<sub>Z</sub></TableHeader>
                                    <TableHeader className="min-w-[70px]">AT<sub>B</sub></TableHeader>

                                    <TableHeader className="border-l-2 border-l-blue-900/50 min-w-[70px]">I<sub>2</sub></TableHeader>
                                    <TableHeader className="min-w-[70px]">1.45 I<sub>Z</sub></TableHeader>
                                    <TableHeader className="text-[10px] min-w-[70px]">I<sub>2</sub> &lt; 1.45 I<sub>Z</sub></TableHeader>
                                    <TableHeader className="min-w-[70px]">AT<sub>TH</sub></TableHeader>

                                    <TableHeader className="border-l-2 border-l-blue-900/50 min-w-[70px]">Δ</TableHeader>
                                    <TableHeader className="min-w-[70px]">I<sub>MS</sub></TableHeader>
                                    <TableHeader className="text-[10px] min-w-[70px]">I<sub>N</sub> ≥ I<sub>MS</sub> / Δ</TableHeader>
                                    <TableHeader className="min-w-[70px]">AT<sub>MS</sub></TableHeader>

                                    <TableHeader className="border-l-2 border-l-blue-900/50 min-w-[70px]">K</TableHeader>
                                    <TableHeader className="min-w-[70px]">I<sub>MI</sub></TableHeader>
                                    <TableHeader className="text-[10px] min-w-[70px]">I<sub>N</sub> ≥ I<sub>MI</sub> / K</TableHeader>
                                    <TableHeader className="min-w-[70px]">AT<sub>MI</sub></TableHeader>

                                    <TableHeader className="border-l-2 border-l-blue-900/50 min-w-[70px]">t<sub>n</sub></TableHeader>
                                    <TableHeader className="min-w-[70px]">t<sub>z</sub></TableHeader>
                                    <TableHeader className="text-[10px] min-w-[70px]">t<sub>n</sub> &lt; t<sub>z</sub></TableHeader>
                                    <TableHeader className="min-w-[70px]">AT<sub>SC</sub></TableHeader>

                                    <TableHeader className="min-w-[70px]">I<sub>N</sub></TableHeader>
                                    <TableHeader className="min-w-[70px]">I<sub>Z</sub></TableHeader>
                                    <TableHeader className="text-[10px] min-w-[70px]">I<sub>B</sub> &lt; I<sub>N</sub> &lt; I<sub>Z</sub></TableHeader>

                                    <TableHeader className="min-w-[70px]">[㎟]</TableHeader>
                                    <TableHeader className="min-w-[70px]">e<sub>B</sub>[%]</TableHeader>
                                    <TableHeader className="min-w-[70px]">L</TableHeader>
                                    <TableHeader className="min-w-[70px]">I<sub>B</sub></TableHeader>

                                    <TableHeader className="min-w-[70px]">[㎟]</TableHeader>
                                    <TableHeader className="min-w-[70px]">t<sub>n</sub></TableHeader>
                                    <TableHeader className="min-w-[70px]">I<sub>SC</sub></TableHeader>
                                    <TableHeader className="text-[10px] min-w-[70px]">I<sub>SC</sub>²t<sub>n</sub>/k</TableHeader>

                                    <TableHeader className="min-w-[70px]">[㎟]</TableHeader>
                                    <TableHeader className="min-w-[70px]">e<sub>B</sub>[%]</TableHeader>
                                    <TableHeader className="min-w-[70px]">L</TableHeader>
                                    <TableHeader className="min-w-[70px]">I<sub>MS</sub></TableHeader>

                                    <TableHeader className="min-w-[70px]">[㎟]</TableHeader>
                                    <TableHeader className="min-w-[70px]">β</TableHeader>
                                    <TableHeader className="min-w-[70px]">t<sub>m</sub></TableHeader>
                                    <TableHeader className="min-w-[70px]">절연물</TableHeader>

                                    <TableHeader className="min-w-[70px]">R</TableHeader>
                                    <TableHeader className="min-w-[70px]">X</TableHeader>

                                    <TableHeader className="min-w-[70px]">[m]</TableHeader>
                                    <TableHeader className="min-w-[70px]">저감수</TableHeader>
                                    <TableHeader className="min-w-[70px]">[℃]</TableHeader>
                                    <TableHeader className="min-w-[70px]">[℃]</TableHeader>
                                    <TableHeader className="min-w-[70px]">[℃]</TableHeader>
                                    <TableHeader className="min-w-[70px]">K·m/W</TableHeader>
                                    <TableHeader className="min-w-[70px]">방법</TableHeader>

                                    <TableHeader className="min-w-[70px]">규격전압</TableHeader>
                                    <TableHeader className="min-w-[70px]">절연</TableHeader>
                                    <TableHeader className="min-w-[70px]">CORE</TableHeader>
                                    <TableHeader className="min-w-[70px]">D</TableHeader>
                                    <TableHeader className="min-w-[70px]">도체</TableHeader>
                                    <TableHeader className="min-w-[70px]">LINE</TableHeader>

                                    <TableHeader className="min-w-[70px]">재질</TableHeader>
                                    <TableHeader className="min-w-[70px]">호칭</TableHeader>
                                    <TableHeader className="min-w-[70px]">LINE</TableHeader>
                                    <TableHeader className="min-w-[70px]">입선</TableHeader>
                                    <TableHeader className="min-w-[70px]">TOT</TableHeader>
                                    <TableHeader className="min-w-[70px]">Chk</TableHeader>
                                    <TableHeader className="min-w-[80px]">공사</TableHeader>
"""

# Stitch it together
new_file_content = content[:insert_start] + replacement_content + content[insert_end:]

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_file_content)

print("Successfully repaired file.")
