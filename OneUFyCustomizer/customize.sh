#!/sbin/sh
SKIPUNZIP=0

# Ensure the module is only installed on Samsung devices running One UI
BRAND=$(getprop ro.product.brand)
[ -z "$BRAND" ] && BRAND=$(getprop ro.product.manufacturer)
[ "$BRAND" != "samsung" ] && [ "$BRAND" != "Samsung" ] && [ -z "$(getprop ro.build.version.sep)" ] && abort "! Non-Samsung device detected. OneUFy requires Samsung One UI."

# Decode the One UI version from property or Samsung Experience Platform (SEP) code (e.g., 70000 -> 7.0, 170500 -> 8.5, 160000 -> 7.0, 150100 -> 6.1)
ONEUI_RAW=$(getprop ro.build.version.oneui)
SEP=$(getprop ro.build.version.sep)

if [ -n "$ONEUI_RAW" ] && [ "$ONEUI_RAW" -gt 10000 ] 2>/dev/null; then
  MAJOR=$(( ONEUI_RAW / 10000 ))
  REM=$(( ONEUI_RAW % 10000 ))
  [ "$REM" -ge 5000 ] || [ "$REM" -ge 500 ] && MINOR="5" || MINOR=$(( REM / 1000 ))
  [ "$MINOR" -eq 0 ] && [ "$REM" -gt 0 ] && MINOR="1"
  ONEUI="One UI ${MAJOR}.${MINOR}"
elif [ -n "$SEP" ] && [ "$SEP" -gt 90000 ] 2>/dev/null; then
  MAJOR=$(( (SEP - 90000) / 10000 ))
  REM=$(( (SEP - 90000) % 10000 ))
  [ "$REM" -ge 5000 ] || [ "$REM" -ge 500 ] && MINOR="5" || MINOR=$(( REM / 1000 ))
  [ "$MINOR" -eq 0 ] && [ "$REM" -gt 0 ] && MINOR="1"
  ONEUI="One UI ${MAJOR}.${MINOR}"
elif [ -n "$ONEUI_RAW" ]; then
  ONEUI="One UI ${ONEUI_RAW}"
else
  ONEUI="Samsung One UI"
fi

ui_print "*************************************************"
ui_print "               OneUFy • Customizer               "
ui_print "*************************************************"
ui_print " - Device:  $(getprop ro.product.model)"
ui_print " - Android: v$(getprop ro.build.version.release)"
ui_print " - Version: $ONEUI"
ui_print "*************************************************"

# Prepare overlay mount point and webroot directory with standard permissions
mkdir -p "$MODPATH/system/product/overlay" "$MODPATH/webroot"
set_perm_recursive "$MODPATH" 0 0 0755 0644
set_perm_recursive "$MODPATH/webroot" 0 0 0755 0644
find "$MODPATH" -type f -name "*.sh" -exec chmod 0755 {} \; 2>/dev/null