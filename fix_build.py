import os, shutil, subprocess, re, sys

SRC = r"D:\gy\OpenCowork\src"
DST = r"D:\claw\wishful-claw\src"

def resolve_and_copy(rel_path, src_base, dst_base):
    oc_path = os.path.join(src_base, rel_path.replace('/', os.sep))
    dst_path = os.path.join(dst_base, rel_path.replace('/', os.sep))
    for ext in ['.ts', '.tsx']:
        if os.path.exists(oc_path + ext):
            os.makedirs(os.path.dirname(dst_path), exist_ok=True)
            shutil.copy2(oc_path + ext, dst_path + ext)
            return True
    if os.path.isdir(oc_path):
        os.makedirs(dst_path, exist_ok=True)
        for item in os.listdir(oc_path):
            s = os.path.join(oc_path, item)
            d = os.path.join(dst_path, item)
            if os.path.isfile(s): shutil.copy2(s, d)
        return True
    return False

for i in range(50):
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=r"D:\claw\wishful-claw",
        capture_output=True, text=True, timeout=60,
        shell=True
    )
    output = result.stdout + result.stderr
    
    if "Build failed" not in output and result.returncode == 0:
        print(f"BUILD SUCCEEDED after {i} iterations!")
        for line in output.split('\n'):
            if 'built in' in line.lower():
                print(f"  {line.strip()}")
        sys.exit(0)
    
    copied = 0
    
    # Could not load
    for m in re.finditer(r"Could not load ([^\s]+?) \(imported by", output):
        missing = m.group(1)
        for prefix, sb, db in [
            ('renderer/src/', 'renderer', 'src'),
            ('renderer\\src\\', 'renderer', 'src'),
            ('shared/', 'shared', ''),
            ('shared\\', 'shared', ''),
        ]:
            p = prefix.replace('\\', '/')
            if p in missing.replace('\\', '/'):
                parts = re.split(re.escape(prefix.replace('\\', '/')), missing.replace('\\', '/'))
                if len(parts) > 1:
                    rel = parts[-1]
                    oc_b = os.path.join(SRC, sb)
                    if db: oc_b = os.path.join(oc_b, db)
                    dst_b = os.path.join(DST, sb)
                    if db: dst_b = os.path.join(dst_b, db)
                    if resolve_and_copy(rel, oc_b, dst_b):
                        copied += 1
                        print(f"  Copied: {rel}")
                    else:
                        print(f"  NOT FOUND: {rel}")
                break
    
    # Could not resolve
    for m in re.finditer(r'Could not resolve "([^"]+)" from "([^"]+)"', output):
        mod, from_file = m.group(1), m.group(2)
        from_dir = os.path.dirname(from_file.replace('/', os.sep))
        if mod.startswith('.'):
            resolved = os.path.normpath(os.path.join(from_dir, mod))
        elif mod.startswith('@renderer/'):
            resolved = os.path.join(DST, 'renderer', 'src', mod.replace('@renderer/', ''))
        elif mod.startswith('@shared/'):
            resolved = os.path.join(DST, 'shared', mod.replace('@shared/', ''))
        else:
            continue
        
        resolved_norm = resolved.replace('\\', '/')
        for prefix in ['renderer/src', 'shared/']:
            if prefix in resolved_norm:
                idx = resolved_norm.find(prefix)
                rel = resolved_norm[idx + len(prefix):].lstrip('/')
                oc_b = os.path.join(SRC, 'renderer', 'src') if 'renderer' in prefix else os.path.join(SRC, 'shared')
                dst_b = os.path.join(DST, 'renderer', 'src') if 'renderer' in prefix else os.path.join(DST, 'shared')
                if resolve_and_copy(rel, oc_b, dst_b):
                    copied += 1
                    print(f"  Copied: {prefix}/{rel}")
                else:
                    print(f"  NOT FOUND: {prefix}/{rel}")
                break
    
    # Not exported by
    for m in re.finditer(r'"([^"]+)" is not exported by "([^"]+)"', output):
        export_name, file_path = m.group(1), m.group(2)
        fn = file_path.replace('\\', '/')
        if 'renderer/src/' in fn:
            parts = fn.split('renderer/src/')
            if len(parts) > 1:
                rel = parts[-1]
                if resolve_and_copy(rel, os.path.join(SRC, 'renderer', 'src'), os.path.join(DST, 'renderer', 'src')):
                    copied += 1
                    print(f"  Replaced: {rel} (export: {export_name})")
                else:
                    print(f"  Cannot fix: {rel}")
    
    if copied == 0:
        print(f"STUCK at iteration {i}")
        for line in output.split('\n'):
            l = line.strip()
            if l and ('error' in l.lower() or 'Could not' in l or 'not exported' in l):
                print(f"  {l}")
        sys.exit(1)
    
    print(f"  Round {i}: {copied} fixed")

print("Max iterations reached")
