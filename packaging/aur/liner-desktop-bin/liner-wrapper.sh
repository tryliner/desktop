#!/bin/sh
# Arch Linux launcher for Liner.
#
# Marks the install as a packaging build: the marker is shown next to the
# core version in the about screen. The renderer bundle can be replaced by
# an OTA update, the core cannot, so the marker lives here.
export LINER_BUILD_FLAVOR="${LINER_BUILD_FLAVOR:-AUR BUILD}"
exec /opt/liner/liner "$@"
