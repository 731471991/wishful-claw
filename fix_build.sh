#!/bin/bash
# Auto-fix missing modules from OpenCowork

OC=/d/gy/OpenCowork/src
WC=/d/claw/wishful-claw/src

for i in $(seq 1 50); do
  # Run build and capture error
  ERROR=$(cd /d/claw/wishful-claw && npm run build 2>&1)
  
  # Check if build succeeded
  if echo "$ERROR" | grep -q "built in" && ! echo "$ERROR" | grep -q "Build failed"; then
    echo "BUILD SUCCEEDED after $i iterations!"
    echo "$ERROR" | grep "built in"
    exit 0
  fi
  
  FIXED=0
  
  # Pattern: Could not load
  MISSING=$(echo "$ERROR" | grep "Could not load" | head -1)
  if [ -n "$MISSING" ]; then
    # Extract path
    PATH_RAW=$(echo "$MISSING" | sed 's/.*Could not load \([^ ]*\) .*/\1/')
    # Try to find in OpenCowork renderer/src
    REL=$(echo "$PATH_RAW" | sed 's|.*renderer/src/||;s|.*renderer.src.||' | tr '\\' '/')
    if [ "$REL" != "$PATH_RAW" ]; then
      # It's in renderer/src
      for ext in .ts .tsx; do
        SRC_FILE="$OC/renderer/src/$REL$ext"
        DST_FILE="$WC/renderer/src/$REL$ext"
        if [ -f "$SRC_FILE" ]; then
          mkdir -p "$(dirname "$DST_FILE")"
          cp "$SRC_FILE" "$DST_FILE"
          echo "  Copied: renderer/src/$REL$ext"
          FIXED=1
          break
        fi
      done
    fi
    # Try shared
    REL=$(echo "$PATH_RAW" | sed 's|.*shared/||;s|.*shared.||' | tr '\\' '/')
    if [ "$REL" != "$PATH_RAW" ] && [ $FIXED -eq 0 ]; then
      for ext in .ts .tsx; do
        SRC_FILE="$OC/shared/$REL$ext"
        DST_FILE="$WC/shared/$REL$ext"
        if [ -f "$SRC_FILE" ]; then
          mkdir -p "$(dirname "$DST_FILE")"
          cp "$SRC_FILE" "$DST_FILE"
          echo "  Copied: shared/$REL$ext"
          FIXED=1
          break
        fi
      done
    fi
  fi
  
  # Pattern: Could not resolve
  RESOLVE=$(echo "$ERROR" | grep "Could not resolve" | head -1)
  if [ -n "$RESOLVE" ] && [ $FIXED -eq 0 ]; then
    MOD=$(echo "$RESOLVE" | sed 's/.*Could not resolve "\([^"]*\)".*/\1/')
    FROM=$(echo "$RESOLVE" | sed 's/.*from "\([^"]*\)".*/\1/')
    
    # Handle relative imports
    FROM_DIR=$(dirname "$FROM")
    if [[ "$MOD" == .* ]]; then
      RESOLVED=$(realpath --relative-to=/d/claw/wishful-claw "$FROM_DIR/$MOD" 2>/dev/null || echo "")
      if [ -n "$RESOLVED" ]; then
        # Find in OpenCowork
        OC_REL=$(echo "$RESOLVED" | sed 's|src/renderer/src/||;s|src/shared/||')
        for prefix in "renderer/src" "shared"; do
          for ext in .ts .tsx; do
            SRC_FILE="$OC/$prefix/$OC_REL$ext"
            DST_FILE="$WC/$prefix/$OC_REL$ext"
            if [ -f "$SRC_FILE" ]; then
              mkdir -p "$(dirname "$DST_FILE")"
              cp "$SRC_FILE" "$DST_FILE"
              echo "  Copied: $prefix/$OC_REL$ext"
              FIXED=1
              break 2
            fi
          done
        done
      fi
    fi
  fi
  
  # Pattern: not exported by
  EXPORT=$(echo "$ERROR" | grep "not exported by" | head -1)
  if [ -n "$EXPORT" ] && [ $FIXED -eq 0 ]; then
    FILE=$(echo "$EXPORT" | sed 's/.*not exported by "\([^"]*\)".*/\1/')
    REL=$(echo "$FILE" | sed 's|src/renderer/src/||' | tr '\\' '/')
    SRC_FILE="$OC/renderer/src/$REL"
    DST_FILE="$WC/renderer/src/$REL"
    if [ -f "$SRC_FILE" ]; then
      cp "$SRC_FILE" "$DST_FILE"
      echo "  Replaced: $REL"
      FIXED=1
    fi
  fi
  
  if [ $FIXED -eq 0 ]; then
    echo "STUCK at iteration $i"
    echo "$ERROR" | grep -E "error|Could not|not exported" | head -3
    exit 1
  fi
  
  echo "  Round $i: fixed"
done

echo "Max iterations reached"
