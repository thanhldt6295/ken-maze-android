# Ken Maze Android

Game Ken tim duong trong me cung de an tom, dong goi bang Capacitor de build APK test va AAB cho Google Play.

## Build online bang GitHub Actions

Project da co workflow tai `.github/workflows/build-android-aab.yml`.

1. Tao repository tren GitHub.
2. Upload toan bo noi dung thu muc `outputs/ken-maze-android` len repository.
3. Vao tab **Actions** tren GitHub.
4. Chon workflow **Build Android AAB**.
5. Bam **Run workflow**.
6. Sau khi chay xong, tai file trong muc **Artifacts** ten `ken-maze-release-aab`.

Neu muon file `.aab` dung de upload Google Play, can ky app bang upload key. Them cac GitHub Secrets sau:

- `KEN_MAZE_KEYSTORE_BASE64`: file keystore `.jks` duoc ma hoa base64.
- `KEN_MAZE_KEYSTORE_PASSWORD`: mat khau keystore.
- `KEN_MAZE_KEY_ALIAS`: alias cua key, nen dat la `ken-maze`.
- `KEN_MAZE_KEY_PASSWORD`: mat khau cua key.

Neu khong them secrets, workflow van co the build ban release khong ky, nhung Google Play se khong nhan de phat hanh.

## Tao file APK de cai test tren dien thoai

Project co workflow `.github/workflows/build-test-apk.yml`.

1. Vao tab **Actions** tren GitHub.
2. Chon workflow **Build Test APK**.
3. Bam **Run workflow**.
4. Khi chay xong, tai artifact `ken-maze-test-apk`.
5. Giai nen artifact, ben trong co file `.apk`.
6. Copy file `.apk` vao dien thoai Android va mo de cai.

File `.apk` nay la ban debug dung de test truc tiep, khong dung de upload len Google Play. Khi cai tren dien thoai, Android co the hoi cho phep **Install unknown apps**.

## Tao upload key online bang GitHub Actions

Project cung co workflow `.github/workflows/generate-upload-key.yml` de tao key online.

Nen dung repository private khi tao key.

1. Vao repository GitHub.
2. Vao **Settings > Secrets and variables > Actions > New repository secret**.
3. Tao 3 secrets:
   - `KEN_MAZE_KEYSTORE_PASSWORD`: mat khau file `.jks`, ban tu dat.
   - `KEN_MAZE_KEY_ALIAS`: dat la `ken-maze`.
   - `KEN_MAZE_KEY_PASSWORD`: mat khau key, ban tu dat.
4. Vao tab **Actions**.
5. Chon workflow **Generate Upload Key**.
6. Bam **Run workflow**.
7. Khi workflow chay xong, tai artifact `ken-maze-upload-key-private-keep-safe`.
8. Giai nen artifact va cat ky file `ken-maze-upload-key.jks`.
9. Mo file `KEN_MAZE_KEYSTORE_BASE64.txt`, copy toan bo noi dung vao GitHub Secret moi ten `KEN_MAZE_KEYSTORE_BASE64`.
10. Quay lai tab **Actions**, chay workflow **Build Android AAB** de tao file `.aab` da ky.

Sau khi tai key ve, nen xoa artifact hoac de artifact tu het han sau 1 ngay. File `.jks`, mat khau keystore va mat khau key phai duoc giu bi mat.

## Ghi chu

- App id hien tai la `com.linh0.kenmaze`.
- Target SDK hien tai la Android 15/API 35.
- Khong upload thu muc `node_modules` len GitHub.
