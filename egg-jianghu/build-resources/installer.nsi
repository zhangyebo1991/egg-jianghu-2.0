Unicode True
!include "MUI2.nsh"

!ifndef APP_VERSION
  !define APP_VERSION "2.0.0"
!endif

!cd "${__FILEDIR__}"

Name "蛋蛋江湖2.0"
OutFile "..\release\蛋蛋江湖2.0-Setup-${APP_VERSION}-x64.exe"
InstallDir "$LOCALAPPDATA\Programs\蛋蛋江湖2.0"
InstallDirRegKey HKCU "Software\蛋蛋江湖2.0" "InstallLocation"
RequestExecutionLevel user
SetCompressor /SOLID lzma
Icon "icon.ico"
UninstallIcon "icon.ico"

VIProductVersion "2.0.0.0"
VIAddVersionKey /LANG=2052 "ProductName" "蛋蛋江湖2.0"
VIAddVersionKey /LANG=2052 "FileDescription" "蛋蛋江湖2.0 安装程序"
VIAddVersionKey /LANG=2052 "FileVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=2052 "ProductVersion" "${APP_VERSION}"

!define MUI_ABORTWARNING
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_FINISHPAGE_RUN "$INSTDIR\蛋蛋江湖2.0.exe"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"

Section "安装蛋蛋江湖2.0" MainSection
  SetOutPath "$INSTDIR"
  File /r "..\release\win-unpacked\*.*"

  WriteUninstaller "$INSTDIR\卸载蛋蛋江湖2.0.exe"
  WriteRegStr HKCU "Software\蛋蛋江湖2.0" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\蛋蛋江湖2.0" "DisplayName" "蛋蛋江湖2.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\蛋蛋江湖2.0" "DisplayIcon" "$INSTDIR\蛋蛋江湖2.0.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\蛋蛋江湖2.0" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\蛋蛋江湖2.0" "UninstallString" "$INSTDIR\卸载蛋蛋江湖2.0.exe"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\蛋蛋江湖2.0" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\蛋蛋江湖2.0" "NoRepair" 1

  CreateDirectory "$SMPROGRAMS\蛋蛋江湖2.0"
  CreateShortcut "$SMPROGRAMS\蛋蛋江湖2.0\蛋蛋江湖2.0.lnk" "$INSTDIR\蛋蛋江湖2.0.exe"
  CreateShortcut "$SMPROGRAMS\蛋蛋江湖2.0\卸载蛋蛋江湖2.0.lnk" "$INSTDIR\卸载蛋蛋江湖2.0.exe"
  CreateShortcut "$DESKTOP\蛋蛋江湖2.0.lnk" "$INSTDIR\蛋蛋江湖2.0.exe"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\蛋蛋江湖2.0.lnk"
  RMDir /r "$SMPROGRAMS\蛋蛋江湖2.0"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\蛋蛋江湖2.0"
  DeleteRegKey HKCU "Software\蛋蛋江湖2.0"
  RMDir /r "$INSTDIR"
SectionEnd
