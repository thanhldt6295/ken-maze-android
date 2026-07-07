# Ky AAB de upload Google Play

Dung 4 secret nay cho game Ken Maze:

- `KEN_MAZE_KEYSTORE_BASE64`
- `KEN_MAZE_KEYSTORE_PASSWORD`
- `KEN_MAZE_KEY_ALIAS`
- `KEN_MAZE_KEY_PASSWORD`

Neu chua co upload key, chay workflow **Generate Upload Key** theo README.

Neu da co file `.jks` tren may, co the tao base64 bang PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("ken-maze-upload-key.jks")) | Set-Clipboard
```

Sau do tao secret `KEN_MAZE_KEYSTORE_BASE64` tren GitHub va chay workflow **Build Android AAB**.
