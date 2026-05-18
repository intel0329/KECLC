import ezdxf
from ezdxf.addons.importer import Importer
from ezdxf import bbox
import json
import sys
import os

def merge_dxfs(json_path):
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        file_paths = data.get('files', [])
        output_path = data.get('output', 'merged.dxf')
        spacing = data.get('spacing', 15000)
        
        if not file_paths:
            print("Error: No files to merge")
            return

        master_doc = ezdxf.new('R2010')
        master_msp = master_doc.modelspace()
        
        x_offset = 0
        
        for idx, path in enumerate(file_paths):
            if not os.path.exists(path):
                continue
                
            try:
                source_doc = ezdxf.readfile(path)
                
                # 계산: 도면의 실제 범위를 측정하여 정렬 기준점 찾기
                # 모든 도면을 상단(Max Y) 기준으로 정렬하기 위해 범위를 구함
                try:
                    extents = bbox.extents(source_doc.modelspace())
                    min_x, min_y = extents.extmin.x, extents.extmin.y
                    max_x, max_y = extents.extmax.x, extents.extmax.y
                except:
                    # 범위 계산 실패 시 기본값 사용
                    min_x, min_y, max_x, max_y = 0, 0, 0, 0

                importer = Importer(source_doc, master_doc)
                block_name = f"PANEL_{idx:03d}"
                new_block = master_doc.blocks.new(name=block_name)
                
                importer.import_entities(source_doc.modelspace(), target_layout=new_block)
                importer.finalize()
                
                # 상단 정렬 (Max Y가 0이 되도록 배치)
                # X는 원래 위치(min_x)를 보정하여 0부터 시작하게 함
                insert_pos = (x_offset - min_x, -max_y)
                master_msp.add_blockref(block_name, insert_pos)
                
                # 다음 도면 배치를 위한 간격 계산 (실제 도면 폭 + 여유 공간)
                width = max_x - min_x
                x_offset += max(width + 2000, spacing)
                
            except Exception as e:
                print(f"Warning: Failed to import {path}: {str(e)}")
            
        master_doc.saveas(output_path)
        print(output_path.replace('\\', '/'))

    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        merge_dxfs(sys.argv[1])
