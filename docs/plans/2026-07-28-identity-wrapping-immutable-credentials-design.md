# 身份密语包装与不可变凭据设计

> 更新时间：2026-07-28
> 状态：已确认，进入实现

## 1. 已确认的产品边界

花钥的确定性生成根输入是主密码和身份密语。两者一旦改变，所有历史 FK-DP1 密码都会改变，因此正式产品不提供普通的主密码修改、身份密语修改或“忘记后设置新主密码”能力。

用户已确认：旧固定 `FlowerKey` 身份值、24 位条目和历史本地数据都是正式发布前的开发数据，可以丢弃。本次不实现旧格式迁移、旧算法兼容或静默转换；验证必须从全新初始化数据开始。

## 2. 方案选择

采用主密码派生的独立身份包装密钥：

```text
identityWrapKey = PBKDF2-HMAC-SHA256(
  password = UTF8(masterPassword),
  salt = UTF8("flowerkey_identity_wrap_" + randomWrapSalt),
  iterations = 600000,
  outputLength = 256 bits
)

encryptedIdentitySecret = AES-256-GCM(
  key = identityWrapKey,
  plaintext = UTF8(NFC(identitySecret)),
  randomIV = 96 bits
)
```

不采用现有数据库密钥包装身份密语，因为数据库密钥本身依赖身份密语，会形成解密循环。不采用设备密钥作为默认包装根，因为严格模式必须允许用户仅凭主密码和本地包装数据解锁，且不得未经授权创建持久化快速解锁材料。

## 3. 持久化格式

`masterPasswordData` 使用唯一正式格式：

```typescript
{
  formatVersion: 1,
  verifyHash: string,
  verifySalt: string,
  identityEnvelope: {
    version: 1,
    kdfSalt: string,
    ciphertext: string
  },
  createdAt: number,
  encryptedMasterPwd?: string,
  recoverySalt?: string
}
```

其中：

- `kdfSalt` 是每次初始化随机生成的身份包装盐；
- `ciphertext` 是 base64 编码的版本字节、96 位随机 IV、AES-GCM 密文与认证标签；
- `identityEnvelope.version` 冻结包装格式；
- 持久化对象中不得出现 `userSalt`、`identitySecret` 或其他身份密语明文字段；
- `verifyHash` 只验证主密码，不参与 FK-DP1；
- 恢复字段只保存由恢复码加密的原主密码。

## 4. 数据流

### 4.1 首次设置

1. 校验并 NFC 规范化身份密语；
2. 生成独立 `verifySalt` 和身份包装 `kdfSalt`；
3. 生成 `verifyHash`；
4. 用主密码派生包装密钥并加密身份密语；
5. 只持久化正式格式；
6. 在当前进程内存中保留主密码、解包后的身份密语和数据库密钥。

### 4.2 严格模式解锁

1. 用户输入主密码；
2. 验证 `verifyHash`；
3. 用主密码解密 `identityEnvelope`；
4. 用解包后的身份密语派生 FK-DP1 根密钥和数据库密钥；
5. 身份密语只在已解锁进程内存中存在；
6. 锁定时清空主密码、身份密语和数据库密钥。

### 4.3 恢复码

恢复码解密得到的必须是原主密码。客户端随后调用正常解锁流程，恢复同一个身份密语、数据库密钥和全部 FK-DP1 密码。恢复成功后直接进入应用，不要求也不允许设置新主密码。

### 4.4 未来快速解锁

Windows Hello、Android/iOS 生物识别或设备 PIN 仅在用户主动授权后实现。设备安全能力应包装独立设备解锁材料，不得改变 `identityEnvelope` 解包后得到的身份密语，也不得改变 FK-DP1。

## 5. 失败行为

- 错误主密码：验证失败，不尝试读取数据库内容；
- 身份包装认证失败：拒绝解锁，报告本地初始化数据损坏；
- 未知 `formatVersion` 或 envelope 版本：拒绝解锁；
- 旧 `userSalt` 明文格式：不迁移、不读取，要求清除开发数据后重新初始化；
- 锁定：清除所有内存态秘密；
- 恢复码错误：不改变任何本地数据。

## 6. 跨端实现

- Core：提供包装、解包、格式守卫和正式主密码数据创建 API；
- Extension/UI/Desktop/Mobile Store：只通过 Core API 设置和解锁，不直接读取身份密语字段；
- Android Autofill：未解锁时从 SQLite 读取 envelope，验证主密码后在原生内存中解包；
- UI：删除全部普通修改主密码入口；
- Mobile：删除恢复后的强制重置状态和页面路由；
- WebDAV：继续同步条目数据，不把身份包装数据变成跨设备重建所必需的远端账户材料。

## 7. 测试与发布门禁

- 包装后对象和序列化 JSON 不得包含身份密语明文；
- 正确主密码可完整解包 Unicode 身份密语；
- 错误主密码、损坏密文和未知版本必须失败；
- 三端 Store setup 不再写入 `userSalt`；
- 三端 unlock 必须先解包再派生数据库密钥；
- 恢复码必须恢复原主密码并直接解锁；
- Store 和设置 UI 不再暴露 `changeMasterPwd`；
- Android 原生解包必须与 Web Crypto 格式兼容；
- FK-DP1 全部固定向量输出必须保持不变。
