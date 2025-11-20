# OIDC Setup for npm Publishing

このドキュメントでは、GitHubとnpmの間でOIDC（OpenID Connect）認証を設定し、トークンを手動登録せずにnpmにパッケージを公開する方法を説明します。

## OIDCとは

OIDC（OpenID Connect）は、GitHub Actionsがnpmなどのサービスと安全に認証するための仕組みです。従来のNPM_TOKENを使用する方法と比較して、以下の利点があります：

- **セキュリティの向上**: トークンをGitHubシークレットに保存する必要がありません
- **自動ローテーション**: 短期的なトークンが自動的に発行されます
- **Provenance（来歴）サポート**: パッケージの出所を暗号学的に証明できます

## 設定手順

### 1. npmでOIDCを有効にする

1. [npmにログイン](https://www.npmjs.com/)します
2. プロフィール > Account Settings > Access Tokens に移動
3. "Generate New Token" > "Granular Access Token" を選択
4. 以下の設定を行います：
   - Token name: 任意の名前（例: `github-actions-oidc`）
   - Expiration: 任意の期間（推奨: 1年）
   - Packages and scopes: 公開したいパッケージを選択
   - Permissions: "Read and write"

**重要**: このトークンは、OIDC設定中の検証用として**一時的に**使用します。OIDC設定完了後は、フォールバック用として保持するか削除できます。

### 2. GitHubシークレットにトークンを追加（オプション）

OIDC認証が利用できない場合のフォールバックとして、NPM_TOKENを設定できます：

1. GitHubリポジトリの Settings > Secrets and variables > Actions に移動
2. "New repository secret" をクリック
3. Name: `NPM_TOKEN`
4. Value: npmで生成したトークンを貼り付け
5. "Add secret" をクリック

### 3. GitHubでOIDC権限を有効にする

ワークフローファイル（`.github/workflows/publish-npm.yml`）に以下の権限が設定されていることを確認してください：

```yaml
permissions:
  contents: read
  id-token: write  # OIDC認証に必要
```

### 4. npmパッケージの公開設定を確認

`package.json`に以下の設定があることを確認してください：

```json
{
  "name": "your-package-name",
  "version": "x.x.x",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/your-org/your-repo.git"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ]
}
```

## 公開方法

### タグを作成してプッシュ

```bash
# バージョンを更新（package.jsonのversionが更新され、gitタグが作成されます）
npm version patch  # または minor, major

# タグをプッシュ（これによりGitHub Actionsが起動します）
git push --follow-tags
```

または、手動でタグを作成：

```bash
# タグを作成
git tag v1.0.0

# タグをプッシュ
git push origin v1.0.0
```

## トラブルシューティング

### OIDC認証が利用できない場合

ワークフローは自動的にNPM_TOKENフォールバックに切り替わります。ログに以下のメッセージが表示されます：

```
⚠ OIDC not available, will use NPM_TOKEN
⚠ Publishing with NPM_TOKEN (legacy method)
Consider setting up OIDC for enhanced security. See docs/OIDC-SETUP.md
```

### 公開が失敗する場合

1. **権限エラー**: npmトークンに正しい権限があることを確認
2. **パッケージ名の競合**: npmで同名のパッケージが既に存在しないか確認
3. **バージョンの重複**: 同じバージョンが既に公開されていないか確認

### Provenanceの確認

パッケージが正常に公開された後、npmのパッケージページでProvenanceバッジを確認できます：

```
https://www.npmjs.com/package/your-package-name
```

"Provenance" セクションに、どのGitHubリポジトリ・コミット・ワークフローから公開されたかが表示されます。

## 参考リンク

- [npm OIDC Documentation](https://docs.npmjs.com/generating-provenance-statements)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [npm Provenance](https://github.blog/2023-04-19-introducing-npm-package-provenance/)
