; Custom NSIS hooks for Titan Protection Desktop installer

!macro customInit
  ; Ensure a clean upgrade path when reinstalling over an existing version
!macroend

!macro customInstall
  ; Register app capability for Windows Settings > Apps list (handled by NSIS uninstaller)
!macroend

!macro customUnInstall
  ; Keep user session data in AppData unless explicitly removed via uninstall option
!macroend
