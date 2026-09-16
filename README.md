# ClipFlux

> macOS용 로컬 다운로드 도우미와 Chrome 확장 프로그램으로 구성된 개인용 미디어 다운로드 워크플로

ClipFlux는 Chrome에서 사용자가 보고 있는 공개 YouTube 동영상의 다운로드 작업을 로컬 macOS 도우미 앱으로 전달합니다. 확장 프로그램은 YouTube 화면과 다운로드 큐를 제공하고, 실제 파일 저장과 변환은 사용자의 컴퓨터에서만 수행합니다.

이 저장소는 개발·테스트·서명·배포를 위한 소스 코드입니다. 일반 사용자는 Node.js나 pnpm을 설치할 필요 없이, 서명 및 공증된 macOS 설치 패키지와 Chrome Web Store 확장 프로그램을 설치하는 형태를 목표로 합니다.

## 목차

- [무엇을 할 수 있나요?](#무엇을-할-수-있나요)
- [지원 범위와 제한](#지원-범위와-제한)
- [구성 및 데이터 흐름](#구성-및-데이터-흐름)
- [일반 사용자 설치](#일반-사용자-설치)
- [개발 환경 빠른 시작](#개발-환경-빠른-시작)
- [명령어 레퍼런스](#명령어-레퍼런스)
- [Chrome 확장 프로그램 개발](#chrome-확장-프로그램-개발)
- [로컬 도우미와 런타임](#로컬-도우미와-런타임)
- [배포용 패키지, 서명 및 공증](#배포용-패키지-서명-및-공증)
- [Chrome Web Store 배포](#chrome-web-store-배포)
- [설정, 저장 위치 및 상태](#설정-저장-위치-및-상태)
- [문제 해결](#문제-해결)
- [보안·개인정보·권리 안내](#보안개인정보권리-안내)
- [프로젝트 구조와 검증](#프로젝트-구조와-검증)

## 무엇을 할 수 있나요?

- YouTube 시청 페이지에서 **Video** 또는 **Audio** 다운로드를 큐에 추가합니다.
- 홈, 검색, 추천, 재생목록 등의 동영상 카드에도 작은 다운로드 버튼을 표시합니다.
- 확장 프로그램 팝업에서 대기·진행·완료·실패 상태와 진행률을 확인합니다.
- 완료된 항목을 클릭해 Finder에서 파일을 엽니다.
- 다운로드가 진행 중이면 도구 모음 아이콘이 진행 상태로 바뀌고, 팝업을 마지막으로 연 뒤 완료된 건수는 배지로 표시합니다.
- 이미 완료한 동영상/형식은 페이지와 카드의 버튼에 완료 표시를 남깁니다.
- 화질, 컨테이너, 오디오 형식·비트레이트, 저장 경로, 비디오/오디오 폴더 분리를 설정합니다.

기본값은 `~/Downloads/YouTube`이며, 비디오와 오디오는 각각 하위 폴더에 저장됩니다.

## 지원 범위와 제한

ClipFlux는 의도적으로 범위를 좁게 유지합니다.

| 항목 | 동작 |
| --- | --- |
| 지원 URL | `https://www.youtube.com/watch?v=…` 형식의 공개 YouTube 시청 페이지 |
| 지원 형식 | 비디오: MP4/WebM, 오디오: 원본/M4A/MP3 |
| 기본 비디오 품질 | 최고 1080p |
| 동시 작업 | 최대 2개 |
| 대기열 한도 | 최대 20개 |
| 완료 표시 | `videoId + video/audio 종류` 기준으로 최대 500개를 확장 프로그램 저장소에 보관 |
| 지원 환경 | macOS, Google Chrome |

다음은 지원하지 않습니다.

- DRM, 로그인, 쿠키, 유료 콘텐츠 또는 접근 제어 우회
- 재생목록 전체 일괄 처리
- 라이브러리/웹 서버를 통한 원격 다운로드 제어
- Windows, Linux 또는 Chromium 외 브라우저용 설치 프로그램

다운로드 기능은 서비스 약관, 저작권 및 사용 권한의 적용을 받을 수 있습니다. 사용자는 다운로드할 권리가 있는 콘텐츠에만 사용해야 합니다.

## 구성 및 데이터 흐름

```text
YouTube 탭
    │  Video / Audio 버튼, 카드 버튼
    ▼
Chrome 확장 프로그램 (Manifest V3)
    │  Chrome Native Messaging
    ▼
local-downloader-helper (macOS 프로세스)
    ├── 다운로드 큐·설정·로그 관리
    ├── yt-dlp
    ├── ffmpeg / ffprobe
    └── Deno 런타임
              │
              ▼
       사용자가 지정한 로컬 폴더
```

### 각 구성 요소의 책임

| 구성 요소 | 위치 | 책임 |
| --- | --- | --- |
| Chrome 확장 프로그램 | `apps/extension` | YouTube UI 주입, 팝업, 설정 UI, 완료 배지, Native Messaging 요청 |
| macOS 도우미 | `apps/helper` | URL 검증, 큐 실행, 진행률 전달, 파일 열기, 설정 및 로그 관리 |
| 프로토콜 패키지 | `packages/protocol` | 확장 프로그램과 도우미가 공유하는 메시지·설정 스키마 |
| 공유 패키지 | `packages/shared` | 공통 상수 및 유틸리티 |
| 빌드/배포 스크립트 | `scripts` | 확장 동기화·ZIP 생성·런타임 다운로드·Native Host 등록·서명·공증 |

확장 프로그램과 도우미는 HTTP 서버나 `localhost` 포트를 열지 않습니다. Chrome Native Messaging의 길이 접두 JSON 메시지로만 통신하며, 메시지 크기는 1MB로 제한합니다.

## 일반 사용자 설치

정식 배포에서는 다음 순서가 사용자 경험의 기준입니다. **pnpm, Bun, Node.js는 일반 사용자에게 요구하지 않습니다.**

1. Chrome Web Store에서 ClipFlux 확장 프로그램을 설치합니다.
2. 제공된 본인 Mac 아키텍처용 `.pkg` 설치 파일을 다운로드해 설치합니다.
   - Apple Silicon: `ClipFlux-arm64.pkg`
   - Intel Mac: `ClipFlux-x64.pkg`
3. Chrome 도구 모음에서 ClipFlux 아이콘을 열고 상태가 `Ready`인지 확인합니다.
4. YouTube 시청 페이지에서 Video 또는 Audio 버튼을 누릅니다.

도우미 설치가 아직 없으면 확장 프로그램의 설치 안내 화면이 열립니다. 정식 빌드에는 설치 패키지 URL을 포함시키고, 개발 빌드에서는 내부 설정 화면으로 안내할 수 있습니다.

## 개발 환경 빠른 시작

### 필요 도구

- macOS와 Google Chrome
- Node.js (프로젝트의 `packageManager`에 맞는 Corepack 사용 권장)
- pnpm 10 이상
- Bun 1.3 이상
- 런타임을 내려받을 때 필요한 인터넷 연결

Node.js와 pnpm이 없다면 개발자 환경에서만 다음처럼 준비할 수 있습니다.

```bash
corepack enable
corepack prepare pnpm@10.15.0 --activate
```

Bun 설치 방법은 [Bun 공식 문서](https://bun.sh/docs/installation)를 따릅니다.

### 처음 한 번 실행하기

```bash
git clone <your-private-repository-url>
cd youtube-downloader
pnpm install

# 개발용 로컬 도우미 바이너리 생성
pnpm helper:build

# yt-dlp, ffmpeg, ffprobe, Deno를 사용자 런타임 폴더에 준비
pnpm runtime:download

# Chrome에 로드할 확장 프로그램 폴더 생성
pnpm extension:build
```

Chrome에서 다음을 수행합니다.

1. 주소창에 `chrome://extensions`를 엽니다.
2. 우측 상단의 **개발자 모드**를 켭니다.
3. **압축해제된 확장 프로그램을 로드합니다**를 누릅니다.
4. 이 저장소의 `dist/chrome-extension` 폴더를 선택합니다.
5. 표시된 확장 프로그램 ID를 복사합니다.

그 ID로 Native Messaging 도우미를 등록합니다.

```bash
LOCAL_DOWNLOADER_EXTENSION_ID=<Chrome에-표시된-32자리-ID> pnpm native:install
```

마지막으로 확장 프로그램 카드의 새로고침 버튼을 누르거나 Chrome을 재시작한 뒤, ClipFlux 팝업에서 `Ready` 상태를 확인합니다.

> `pnpm extension:build`는 `dist/chrome-extension` **폴더 자체를 지우지 않고 내부 파일만 동기화**합니다. 한 번 Chrome에 압축해제 로드한 폴더를 매번 다시 선택할 필요는 없습니다. 단, JavaScript·manifest 변경 사항은 `chrome://extensions`에서 확장 프로그램을 새로고침해야 반영됩니다.

### 개발 중 빠른 루프

```bash
# 확장 프로그램과 도우미를 각각 감시 모드로 실행
pnpm dev
```

또는 필요한 대상만 실행합니다.

```bash
pnpm extension:dev
pnpm helper:dev
```

도우미 개발 모드는 `LOCAL_DOWNLOADER_DEV=1`을 설정하여 Homebrew 또는 `/usr/local`의 개발용 실행 파일도 탐색합니다. 실제 Chrome Native Host에 연결해 점검할 때는 `pnpm helper:build` 후 `pnpm native:install` 절차를 사용합니다.

## 명령어 레퍼런스

모든 명령은 저장소 루트에서 실행합니다.

| 명령 | 용도 | 결과/비고 |
| --- | --- | --- |
| `pnpm install` | 워크스페이스 의존성 설치 | 개발자 전용 |
| `pnpm dev` | 확장 프로그램·도우미 감시 실행 | 로컬 개발용 |
| `pnpm extension:dev` | WXT 확장 프로그램 개발 서버 | 확장 프로그램만 개발할 때 |
| `pnpm extension:build` | Chrome용 확장 프로그램 빌드 | `dist/chrome-extension`에 바로 생성 |
| `pnpm extension:package` | Web Store 업로드 ZIP 생성 | `dist/ClipFlux-extension-<version>.zip` |
| `pnpm helper:build` | 로컬 도우미 바이너리 생성 | `dist/local-downloader-helper` |
| `pnpm helper:dev` | 도우미 감시 실행 | 개발용 실행 파일 탐색 허용 |
| `pnpm runtime:download` | 필수 런타임 다운로드·검증 | 사용자 Application Support 폴더에 저장 |
| `pnpm native:install` | 개발용 Native Host 등록 | 확장 ID 환경 변수가 필요 |
| `pnpm native:uninstall` | 개발용 Native Host 등록 제거 | Chrome Native Messaging 연결 해제 |
| `pnpm package:macos` | 서명 가능한 macOS `.pkg` 생성 | 사전 빌드·런타임 준비 필요 |
| `pnpm notarize:macos` | macOS 패키지 공증·staple | Apple notarytool profile 필요 |
| `pnpm release:preflight:macos` | macOS 배포 환경 점검 | 인증서·ID·공증 프로필 검증 |
| `pnpm release:macos` | 품질 검사부터 공증까지 배포 파이프라인 | 아래 [배포용 패키지](#배포용-패키지-서명-및-공증) 참고 |
| `pnpm lint` | ESLint 검사 | |
| `pnpm typecheck` | TypeScript 타입 검사 | 모든 워크스페이스 대상 |
| `pnpm test` | Vitest 테스트 실행 | |

### Chrome Web Store용 ZIP만 만들기

```bash
pnpm extension:package
```

이 한 줄이 확장 프로그램 빌드, `dist/chrome-extension` 동기화, ZIP 생성, ZIP 내부 구조 검증까지 수행합니다. 별도로 `mkdir`, `ditto`, Finder 압축을 실행하지 마세요.

업로드 파일은 다음 위치에 생깁니다.

```text
dist/ClipFlux-extension-0.1.0.zip
```

ZIP을 풀었을 때 최상위에 바로 `manifest.json`이 있어야 합니다. `chrome-extension/manifest.json`처럼 한 단계 더 감싼 ZIP은 Web Store 업로드 대상이 아닙니다.

## Chrome 확장 프로그램 개발

### 압축해제 로드 폴더

Chrome에는 아래 폴더를 선택합니다.

```text
dist/chrome-extension
```

`apps/extension/.output/chrome-mv3`는 WXT의 중간 빌드 결과입니다. Chrome에 항상 로드하는 기준 폴더는 `dist/chrome-extension`입니다.

### 확장 ID와 Native Host 허용 목록

Chrome Native Messaging manifest는 특정 확장 ID만 도우미 실행을 허용합니다. 따라서 다음 환경 변수에는 `chrome://extensions`에 표시되는 값을 정확히 넣어야 합니다.

```bash
LOCAL_DOWNLOADER_EXTENSION_ID=abcdefghijklmnopabcdefghijklmnop pnpm native:install
```

형식은 `a`부터 `p`까지의 소문자 32개입니다. ID가 다르거나 누락되면 도우미는 설치되어 있어도 확장 프로그램이 연결하지 못합니다.

개발용 Native Host manifest 위치는 다음과 같습니다.

```text
~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.localdownloader.helper.json
```

### 버튼 UI 동작

- 시청 페이지: YouTube의 액션 행에서 Video/Audio 버튼을 제공합니다.
- 카드/목록: 카드의 메타데이터 영역 또는 더보기 버튼 주변에 작은 Video/Audio 아이콘을 배치합니다.
- 완료 상태: 동일한 동영상과 형식이 완료되면 해당 버튼이 완료 상태로 바뀝니다.
- 동적 페이지: YouTube의 무한 스크롤·탭 전환으로 카드가 다시 만들어져도 관찰자로 버튼을 다시 주입합니다.

YouTube는 실험군과 화면 폭에 따라 DOM 구조가 바뀝니다. 카드 버튼 위치가 어긋나면 새로고침 후에도 재현되는 URL, 화면 크기, 해당 카드의 DOM 선택자 정보를 함께 확인하세요.

### 팝업을 열 수 없을 때

팝업 JavaScript나 manifest를 수정한 뒤에는 Chrome이 이전 번들을 계속 사용합니다. 아래 순서를 지키면 됩니다.

```bash
pnpm extension:build
```

그 다음 `chrome://extensions`에서 ClipFlux의 **새로고침**을 누르고, 도구 모음 아이콘을 다시 클릭합니다. 확장 프로그램 카드가 `오류` 상태라면 **오류** 버튼을 열어 첫 번째 오류를 확인합니다.

## 로컬 도우미와 런타임

### 런타임 다운로드

```bash
pnpm runtime:download
```

이 명령은 다음 도구를 내려받아 검증한 뒤 사용자 런타임 폴더에 둡니다.

- `yt-dlp`
- `ffmpeg`
- `ffprobe`
- `deno`

개발 환경에서 `yt-dlp`가 `/opt/homebrew/bin/yt-dlp` 또는 `/usr/local/bin/yt-dlp`에 있으면 도우미는 이를 먼저 사용할 수 있습니다. 배포 패키지에서는 `/Library/LocalDownloader/runtime`에 번들된 실행 파일을 사용하고, 첫 실행 때 사용자 런타임 디렉터리로 복사할 수 있습니다.

### Native Host 등록과 제거

```bash
# 등록
LOCAL_DOWNLOADER_EXTENSION_ID=<extension-id> pnpm native:install

# 제거
pnpm native:uninstall
```

개발 등록은 현재 사용자에게만 적용됩니다. 정식 macOS 설치 패키지는 시스템 Native Host manifest와 도우미·런타임을 함께 설치하므로 사용자가 이 명령을 실행할 필요가 없습니다.

### 다운로드 큐의 동작

- URL은 공개 YouTube 시청 URL로 정규화하고 검증합니다.
- 같은 동영상과 같은 형식의 활성 작업을 중복해서 추가할 수 없습니다.
- 최대 2개를 동시에 실행하고 나머지는 대기합니다.
- 최대 20개의 작업만 큐에 넣을 수 있습니다.
- 큐의 최근 종료 작업은 메모리에 최대 12개 유지됩니다.
- 완료 파일 열기는 해당 완료 작업이 현재 도우미의 큐 기록에 남아 있을 때 사용할 수 있습니다.

큐 자체는 도우미 프로세스 메모리에 있습니다. 도우미 또는 Chrome이 다시 시작되면 진행 중·대기 중 작업 목록은 복구되지 않습니다. 반면 이미 완료했다는 UI 표시는 확장 프로그램의 로컬 저장소에 별도로 보관됩니다.

## 배포용 패키지, 서명 및 공증

정식 macOS 배포에는 Apple Developer Program의 Developer ID 인증서와 Notarization 권한이 필요합니다. 이 단계는 **배포 담당자**만 수행합니다.

### 배포 전 준비

Keychain Access 또는 `security find-identity -v -p codesigning`으로 다음 인증서를 확인합니다.

- `Developer ID Application: …`
- `Developer ID Installer: …`

공증 자격 증명은 한 번만 저장합니다. 아래 명령은 Apple ID, Team ID, 앱 전용 비밀번호를 대화형으로 받습니다.

```bash
xcrun notarytool store-credentials LocalDownloader \
  --apple-id <apple-id> \
  --team-id <team-id>
```

기본 프로필 이름은 `LocalDownloader`입니다. 다른 이름을 사용한다면 이후 명령에 `LOCAL_DOWNLOADER_NOTARY_PROFILE=<profile-name>`을 지정합니다.

### 사전 점검

```bash
pnpm release:preflight:macos
```

이 검사는 확장 프로그램 ID, Developer ID Application/Installer 인증서, 공증 프로필 등 배포에 필요한 입력이 준비되었는지 확인합니다.

### 수동 배포 단계

```bash
# 1) 소스 품질 검사
pnpm lint
pnpm typecheck
pnpm test

# 2) 검증된 런타임과 도우미 준비
pnpm runtime:download
pnpm helper:build

# 3) 현재 Mac 아키텍처용 서명 패키지 생성
pnpm package:macos

# 4) Apple 공증 후 staple
pnpm notarize:macos
```

또는 전체 흐름을 한 번에 실행합니다.

```bash
pnpm release:macos
```

이 파이프라인은 사전 점검, lint, typecheck, test, 런타임 다운로드, 도우미 빌드, 패키지 생성, 공증을 순서대로 실행합니다.

### 생성물과 설치 위치

현재 실행 중인 Mac의 CPU 아키텍처에 맞춰 다음 파일 중 하나가 생성됩니다.

```text
dist/ClipFlux-arm64.pkg
dist/ClipFlux-x64.pkg
```

패키지는 다음을 설치합니다.

| 설치 대상 | 위치 |
| --- | --- |
| 로컬 도우미 | `/Library/LocalDownloader/local-downloader-helper` |
| 번들 런타임 | `/Library/LocalDownloader/runtime/` |
| 시스템 Native Host manifest | `/Library/Google/Chrome/NativeMessagingHosts/com.localdownloader.helper.json` |

패키지 생성은 현재 머신의 아키텍처용으로 수행합니다. Apple Silicon과 Intel용 배포 파일이 모두 필요하면 각 아키텍처 환경에서 각각 빌드·서명·공증합니다.

## Chrome Web Store 배포

### 업로드 전 ID를 고정해야 하는 이유

Native Messaging manifest는 확장 프로그램 ID를 허용 목록으로 가집니다. Web Store에서 배포할 확장 프로그램의 ID가 개발용 압축해제 확장 ID와 달라지면, 정식 macOS 패키지는 배포 확장 프로그램과 통신하지 못합니다.

따라서 Web Store에 처음 등록할 때 확장 프로그램의 공개 키 또는 확정된 Item ID를 확보하고, 이를 기준으로 확장 프로그램 키와 macOS 패키지의 허용 ID를 일치시켜야 합니다.

### 권장 배포 순서

1. Chrome Web Store Developer Dashboard에서 새 항목을 만들고 확장 프로그램 ID/공개 키를 확정합니다.
2. 해당 공개 키로 확장 프로그램을 빌드해 ID를 안정화합니다.
3. 동일한 ID를 `LOCAL_DOWNLOADER_EXTENSION_ID`에 넣어 macOS 패키지를 만듭니다.
4. 서명·공증된 `.pkg`를 안전한 HTTPS URL에 게시합니다.
5. 그 설치 URL을 포함한 확장 프로그램 ZIP을 만들고 Web Store에 업로드합니다.

예시:

```bash
export LOCAL_DOWNLOADER_EXTENSION_ID=<web-store-extension-id>
export WXT_EXTENSION_KEY='<Chrome-Web-Store-public-key>'
export WXT_INSTALLER_URL='https://downloads.example.com/ClipFlux-arm64.pkg'

pnpm extension:package
pnpm release:macos
```

설치 안내 버튼은 항상 확장 프로그램 안의 `setup.html`을 먼저 열어 설치 단계와 연결 상태를 보여 줍니다. `WXT_INSTALLER_URL`이 설정된 정식 빌드에서는 그 화면에 실제 `.pkg`를 여는 **macOS용 엔진 다운로드** 버튼이 표시됩니다. 설정하지 않은 소스 개발 빌드에서만 개발자용 수동 명령을 표시합니다.

### 스토어 등록 문구 주의

Chrome Web Store 정책과 YouTube 이용약관을 검토한 뒤, 기능 설명·스크린샷·개인정보 처리방침·권한 사유를 실제 동작과 일치하게 작성해야 합니다. 특히 제3자 콘텐츠 다운로드를 조장하거나 권리·보호 장치를 우회하는 표현은 피하고, 사용자가 권리를 가진 공개 콘텐츠에 대한 로컬 저장 워크플로라는 범위를 명확히 하세요. 스토어 심사 통과를 보장하지는 않습니다.

## 설정, 저장 위치 및 상태

### 기본 다운로드 설정

| 설정 | 기본값 | 선택지/설명 |
| --- | --- | --- |
| 비디오 화질 | `best-up-to-1080p` | `best`, `2160p`, `1440p`, `1080p`, `720p`, `480p` |
| 비디오 컨테이너 | `mp4` | MP4 또는 WebM |
| 오디오 형식 | `original` | 원본, M4A, MP3 |
| MP3 비트레이트 | `320` kbps | 320, 256, 192 kbps |
| 저장 경로 | `~/Downloads/YouTube` | 팝업에서 변경 |
| 폴더 분리 | 활성화 | Video/Audio 하위 폴더로 분리 |
| yt-dlp 자동 업데이트 | 활성화 | 도우미 시작 시 확인 |

MP3 재인코딩은 원본보다 음질을 높이지 않습니다. 비트레이트 선택은 출력 인코딩의 상한일 뿐입니다.

### 로컬 파일 위치

| 데이터 | 위치 | 용도 |
| --- | --- | --- |
| 사용자 설정 | `~/Library/Application Support/LocalDownloader/config.json` | 저장 위치·형식·업데이트 설정 |
| 다운로드 런타임 | `~/Library/Application Support/LocalDownloader/runtime/` | 사용자별 yt-dlp, ffmpeg, ffprobe, deno |
| 도우미 로그 | `~/Library/Application Support/LocalDownloader/helper.log` | 오류 및 실행 진단 |
| 개발 Native Host manifest | `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.localdownloader.helper.json` | Chrome↔개발 도우미 연결 |
| 확장 프로그램 상태 | Chrome `storage.local` | UI 설정, 최근 완료 표시, 배지 카운트 |

설정 파일은 원자적으로 쓰고 사용자만 읽고 쓸 수 있는 권한으로 만듭니다. 민감한 로그인 쿠키나 브라우저 비밀번호를 저장하지 않습니다.

### 완료 표시와 배지의 의미

- 완료 표시: 최근 완료 이력을 확장 프로그램에 저장합니다. 파일 시스템을 스캔하지 않으므로, Finder에서 파일을 지워도 즉시 사라지지 않을 수 있습니다.
- 배지 숫자: 팝업을 마지막으로 연 뒤 완료된 다운로드 수입니다. 팝업을 열면 0으로 초기화됩니다.
- 진행 아이콘: 하나 이상의 작업이 실행 중이거나 대기 중일 때 표시됩니다.

## 문제 해결

### Install Downloader를 누르면 404 또는 존재하지 않는 페이지가 열립니다

개발 빌드에서 설치 파일 URL이 설정되지 않았거나, 예전 예시 URL이 번들된 경우입니다.

- 개발 중: 확장 프로그램의 설정 화면에서 도우미 상태와 설치 명령을 확인합니다.
- 배포 중: 실제 `.pkg`의 HTTPS URL을 `WXT_INSTALLER_URL`에 설정한 뒤 `pnpm extension:package`로 다시 빌드합니다.

### `Downloader setup required` 또는 `Ready`가 표시되지 않습니다

다음을 순서대로 확인합니다.

```bash
pnpm helper:build
pnpm runtime:download
LOCAL_DOWNLOADER_EXTENSION_ID=<chrome-extension-id> pnpm native:install
```

그 다음 Chrome 확장 프로그램을 새로고침하고 팝업을 다시 엽니다. 확장 ID는 `chrome://extensions`의 ClipFlux 카드에서 복사한 값과 정확히 같아야 합니다.

### Video/Audio를 누르면 다운로드가 시작되지 않습니다

1. URL이 `https://www.youtube.com/watch?v=…` 공개 시청 페이지인지 확인합니다.
2. 팝업에서 실패 작업의 오류 메시지를 확인합니다.
3. `~/Library/Application Support/LocalDownloader/helper.log`의 마지막 오류를 확인합니다.
4. `pnpm runtime:download`를 다시 실행해 런타임이 온전한지 확인합니다.
5. 큐가 20개에 도달했거나 같은 동영상·형식의 작업이 이미 활성 상태인지 확인합니다.

DRM·로그인 전용·유료·지역 제한 콘텐츠는 지원 대상이 아닙니다.

### macOS에서 `Python.framework`이 손상되었다는 경고가 표시됩니다

이 경고는 보통 Chrome이 다운로드한 Python 관련 보조 파일을 macOS가 신뢰하지 못할 때 나타납니다. ClipFlux의 정식 배포 경로는 사용자의 Python.framework 설치에 의존하지 않습니다.

- 이전에 내려받은 수동 스크립트/앱은 휴지통으로 이동합니다.
- 공증된 ClipFlux `.pkg`를 다시 설치합니다.
- 팝업 상태가 `Ready`인지 확인합니다.

### 확장 프로그램 아이콘을 눌러도 팝업이 열리지 않습니다

```bash
pnpm extension:build
```

이후 `chrome://extensions`에서 ClipFlux를 새로고침합니다. 여전히 열리지 않으면 확장 프로그램 카드의 **오류**를 열어 첫 오류를 확인하고, `dist/chrome-extension/manifest.json`이 존재하는지 확인합니다. 빌드 후 Chrome의 확장 프로그램 새로고침을 하지 않으면 이전 팝업 번들이 계속 실행될 수 있습니다.

### 다운로드 버튼이 카드 밖으로 나오거나 위치가 어긋납니다

YouTube는 같은 카드라도 홈·검색·추천·미니 플레이어·실험 UI에서 DOM 구조가 다릅니다. 페이지를 새로고침해 최신 주입 로직을 적용한 뒤에도 문제라면 다음을 기록해 재현 범위를 좁힙니다.

- URL과 화면 폭
- 홈/검색/시청 페이지/추천 목록 중 어느 화면인지
- 버튼이 잘못 배치된 카드의 DevTools 상위 요소 선택자
- Chrome 확장 프로그램 버전과 YouTube UI 언어

### Chrome에서 Native Host를 찾지 못합니다

- Native Host manifest의 `allowed_origins`에 현재 확장 ID가 있는지 확인합니다.
- 개발용 manifest 경로와 도우미 실행 파일 경로가 존재하는지 확인합니다.
- macOS 패키지 설치 후에는 시스템 manifest인 `/Library/Google/Chrome/NativeMessagingHosts/com.localdownloader.helper.json`을 확인합니다.
- Chrome을 완전히 종료한 뒤 다시 열어 등록 정보를 새로 읽게 합니다.

### 공증 또는 서명 단계가 실패합니다

```bash
pnpm release:preflight:macos
```

먼저 이 점검에서 누락된 인증서나 notarytool profile을 해결합니다. 인증서가 여러 개인 경우 스크립트가 선택한 Developer ID Application/Installer identity가 의도한 Team ID인지도 확인하세요.

## 보안·개인정보·권리 안내

### 보안 설계 원칙

- 확장 프로그램은 Native Messaging으로만 로컬 도우미에 연결합니다.
- 도우미는 길이 접두 JSON 프로토콜만 표준 입출력으로 처리하며 네트워크 포트를 열지 않습니다.
- URL은 허용된 공개 YouTube 시청 URL로 제한하고, 다운로드 명령은 셸 문자열 조합이 아닌 인수 배열로 실행합니다.
- 설정 파일은 사용자 전용 권한으로 작성합니다.
- 배포 파일은 Developer ID 서명과 Apple 공증을 거칩니다.

### 개인정보

ClipFlux는 사용자의 브라우저 로그인 쿠키, 비밀번호, 계정 토큰을 수집하거나 저장하도록 설계되지 않았습니다. 다운로드 기록과 설정은 사용자의 Chrome 프로필 및 로컬 Application Support 디렉터리에 남습니다.

### 콘텐츠 권리

이 프로젝트는 법률 자문이 아닙니다. 서비스 약관, 저작권, 라이선스 및 지역 법령을 확인하고, 본인이 소유했거나 저장 권한을 가진 콘텐츠에만 사용하세요.

## 프로젝트 구조와 검증

```text
.
├── apps/
│   ├── extension/          # WXT + React Chrome MV3 확장 프로그램
│   └── helper/             # Bun으로 빌드하는 macOS Native Messaging 도우미
├── packages/
│   ├── protocol/           # 공유 메시지/설정 Zod 스키마
│   └── shared/             # 공통 상수와 유틸리티
├── scripts/                # 빌드, 런타임, 설치, 패키징, 공증 자동화
├── dist/                   # 생성물 (Git 추적 제외)
├── docs/                   # 설계 및 운영 보조 문서
├── package.json
└── pnpm-workspace.yaml
```

변경 전 또는 배포 전에는 다음 검증을 실행합니다.

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Chrome UI 또는 Native Messaging 변경이 포함되면 아래도 확인합니다.

```bash
pnpm extension:build
pnpm helper:build
pnpm runtime:download
```

이후 `chrome://extensions`에서 확장 프로그램을 새로고침하고 다음을 수동 점검합니다.

1. 팝업이 열리고 도우미 상태가 보이는지
2. 시청 페이지와 카드 목록에 버튼이 적절한 위치로 표시되는지
3. Video/Audio 작업이 큐에 추가되고 진행률이 변하는지
4. 완료 항목 클릭으로 파일이 열리는지
5. 진행 아이콘과 완료 배지가 팝업을 열었을 때 기대대로 초기화되는지

## 기여 및 변경 원칙

- 생성물인 `dist/`, `.output/`, `.wxt/`는 커밋하지 않습니다.
- Chrome에 압축해제 로드한 `dist/chrome-extension`의 루트 경로는 유지합니다.
- 프로토콜 변경은 확장 프로그램과 도우미 양쪽의 스키마·테스트를 함께 갱신합니다.
- YouTube DOM 선택자는 단일 화면만 기준으로 추가하지 말고, 홈·검색·시청 페이지에서 겹침과 반응형 위치를 점검합니다.
- 배포용 설치 URL, 확장 프로그램 ID, Developer ID 인증서 정보, Apple 자격 증명은 소스에 하드코딩하거나 커밋하지 않습니다.

---

ClipFlux는 로컬 우선 구조를 유지합니다. 설치나 배포 중 막히면 먼저 이 README의 [문제 해결](#문제-해결)과 로컬 도우미 로그를 확인하세요.
