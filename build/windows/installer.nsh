; installer.nsh — include via electron-builder's nsis.include

;======================================================================
; customInstall macro is invoked by electron-builder after files are in $INSTDIR
!macro customInstall
  ; Ask the user if they want to register file associations
  MessageBox MB_YESNO|MB_ICONQUESTION \
  "Do you want to associate Markdown files (.md, .markdown, .mmd, .mdown, .mdtext, .mdx) with AinCore Notes?" /SD IDNO IDNO SkipAssoc

  ;— User clicked YES, perform the registry writes —
  WriteRegStr HKCU "Software\Classes\.md"       "" "AinCoreNotes.Document"
  WriteRegStr HKCU "Software\Classes\.markdown" "" "AinCoreNotes.Document"
  WriteRegStr HKCU "Software\Classes\.mmd"      "" "AinCoreNotes.Document"
  WriteRegStr HKCU "Software\Classes\.mdown"    "" "AinCoreNotes.Document"
  WriteRegStr HKCU "Software\Classes\.mdtxt"    "" "AinCoreNotes.Document"
  WriteRegStr HKCU "Software\Classes\.mdtext"   "" "AinCoreNotes.Document"
  WriteRegStr HKCU "Software\Classes\.mdx"      "" "AinCoreNotes.Document"

  WriteRegStr HKCU "Software\Classes\AinCoreNotes.Document" \
    "" "AinCore Notes Markdown Document"
  WriteRegExpandStr HKCU "Software\Classes\AinCoreNotes.Document\DefaultIcon" \
    "" "$INSTDIR\resources\icons\md.ico,0"
  WriteRegExpandStr HKCU "Software\Classes\AinCoreNotes.Document\shell\open\command" \
    "" '"$INSTDIR\aincore-notes.exe" "%1"'

SkipAssoc:
!macroend

;======================================================================
; customUnInstall macro cleans up on uninstall
!macro customUnInstall
  ; Delete the open command subtree
  DeleteRegKey HKCU "Software\Classes\AinCoreNotes.Document\shell\open\command"
  DeleteRegKey HKCU "Software\Classes\AinCoreNotes.Document\shell\open"
  DeleteRegKey HKCU "Software\Classes\AinCoreNotes.Document\shell"

  ; Delete the DefaultIcon and ProgID
  DeleteRegKey HKCU "Software\Classes\AinCoreNotes.Document\DefaultIcon"
  DeleteRegKey HKCU "Software\Classes\AinCoreNotes.Document"

  ; Delete each extension mapping
  DeleteRegKey HKCU "Software\Classes\.md"
  DeleteRegKey HKCU "Software\Classes\.markdown"
  DeleteRegKey HKCU "Software\Classes\.mmd"
  DeleteRegKey HKCU "Software\Classes\.mdown"
  DeleteRegKey HKCU "Software\Classes\.mdtxt"
  DeleteRegKey HKCU "Software\Classes\.mdtext"
  DeleteRegKey HKCU "Software\Classes\.mdx"

  MessageBox MB_YESNO "Do you want to delete user settings?" /SD IDNO IDNO SkipRemoval
    SetShellVarContext current
    RMDir /r "$APPDATA\aincore-notes"
  SkipRemoval:
!macroend
