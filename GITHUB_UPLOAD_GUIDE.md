# 🚀 깃허브(GitHub) 업로드 및 무료 웹사이트 배포 가이드

깃허브 웹사이트에서 폴더 통째로 드래그할 때 업로드가 실패하는 문제를 완벽히 해결하기 위해, **모든 기능이 내장된 독립 실행형 `index.html` 파일**로 최적화되었습니다.

이제 `index.html` 파일 하나만 깃허브에 올려도 100% 정상 작동하며, **GitHub Pages** 기능을 켜면 누구나 접속할 수 있는 무료 웹사이트 주소(URL)가 생성됩니다!

---

## 📌 방법 1: 깃허브 웹사이트에서 직접 올리기 (가장 쉬운 방법, 1분 소요)

### 1단계: 깃허브 저장소(Repository) 만들기
1. [GitHub(github.com)](https://github.com)에 로그인합니다.
2. 우측 상단의 **`+`** 버튼 클릭 ➔ **`New repository`** 클릭
3. **Repository name**에 원하는 이름(예: `seed-workbook`) 입력
4. **Public** 선택 ➔ **`Add a README file`** 체크 ➔ 하단의 **`Create repository`** 버튼 클릭

---

### 2단계: 파일 업로드하기
1. 생성된 저장소 화면에서 **`Add file`** ➔ **`Upload files`** 클릭
2. 바탕화면의 `SEED프로그램` 폴더 안에 있는 아래 파일들을 드래그하여 업로드합니다:
   - ⭐ **`index.html`** (가장 중요!)
   - **`404.html`**
   - **`.nojekyll`**
   - **`README.md`**
3. 하단의 초록색 **`Commit changes`** 버튼을 누르면 업로드 완료!

---

### 3단계: 무료 웹사이트로 공개하기 (GitHub Pages 활성화)
1. 저장소 상단 메뉴에서 **`Settings` (설정)** 탭 클릭
2. 좌측 사이드바 메뉴에서 **`Pages`** 클릭
3. **Build and deployment** 항목의:
   - **Source**: `Deploy from a branch` 선택
   - **Branch**: `main` (또는 `master`) 선택 및 `/ (root)` 선택
4. **`Save`** 버튼 클릭!
5. 약 30초~1분 후 새로고침하면 상단에 접속 가능한 웹사이트 링크가 표시됩니다:
   👉 **`https://[내아이디].github.io/seed-workbook/`**

---

## 💻 방법 2: Git 명령어로 업로드하기 (개발자용)

Git이 설치되어 있는 경우 터미널에서 다음 명령어를 실행하여 바로 업로드할 수 있습니다:

```bash
git init
git add .
git commit -m "Initial commit for SEED Workbook Web App"
git branch -M main
git remote add origin https://github.com/[내아이디]/[저장소이름].git
git push -u origin main
```
