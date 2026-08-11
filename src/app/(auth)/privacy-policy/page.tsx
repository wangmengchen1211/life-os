'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--bg-gradient, #fafaf8)' }}
    >
      {/* 顶部导航 */}
      <div className="sticky top-0 z-10 backdrop-blur-md bg-white/60 border-b border-black/5">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft size={20} strokeWidth={1.5} />
          </button>
          <h1 className="text-lg font-light tracking-wide text-gray-700">
            隐私协议
          </h1>
        </div>
      </div>

      {/* 正文 */}
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-light tracking-wider text-gray-800 mb-2">
            MindOS 用户隐私协议
          </h2>
          <p className="text-sm italic text-gray-400">
            更新日期：2026年5月13日
          </p>
        </div>

        <div className="space-y-10 text-[15px] leading-[1.9] text-gray-600">
          {/* 引言 */}
          <section>
            <p>
              MindOS 是一款安静写意的个人心智管理应用。我们深知您的日记、笔记与思考有多私密，因此本协议用最直白的话告诉您：我们怎么对待您的数据。
            </p>
          </section>

          {/* 一 */}
          <section>
            <h3 className="text-base font-normal tracking-wide text-gray-700 mb-3">
              一、我们收集什么
            </h3>
            <ul className="space-y-2 list-none pl-0">
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>您主动输入的内容：日记、笔记、知识片段、待办事项、错题记录</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>您导入的内容：飞书文档、Obsidian 笔记、微信公众号文章链接</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>您上传的图片：仅用于本地 OCR 文字识别，识别在您的设备或应用服务器上完成，图片原始数据不传输至任何外部服务，识别后不保留</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>登录密码：由身份认证服务（Supabase Auth）以业界标准的加盐哈希形式加密存储，不以明文形式保存</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span className="font-light text-gray-500">
                  我们不收集：位置信息、通讯录、设备标识符、浏览记录、行为画像
                </span>
              </li>
            </ul>
          </section>

          {/* 二 */}
          <section>
            <h3 className="text-base font-normal tracking-wide text-gray-700 mb-3">
              二、数据存在哪里
            </h3>
            <ul className="space-y-2 list-none pl-0">
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>您的日记、笔记、知识库、待办事项等全部个人内容：存储在您浏览器或应用本地的 IndexedDB 数据库中（数据库名：diary-db、knowledge-db、todo-db、mindlog-db）</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>登录云同步时，您的内容会加密传输并同步至 Supabase 云数据库（新加坡区域），用于跨设备访问；数据库启用行级安全策略（RLS），任何用户只能读写自己的数据</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>您可以在设置页「数据管理」中随时导出全部数据为 JSON 文件，也可以逐模块选择清除</span>
              </li>
            </ul>
          </section>

          {/* 三 */}
          <section>
            <h3 className="text-base font-normal tracking-wide text-gray-700 mb-3">
              三、AI 分析时会发生什么
            </h3>
            <ul className="space-y-2 list-none pl-0">
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>当您使用 AI 功能（日记反馈、知识打标、洞见提问、心智日志生成、每日回音等），相关文本会临时发送至 AI 服务提供商进行处理</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>当前使用的 AI 服务商：通义千问（经阿里云 DashScope API 调用）</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>图片文字识别（OCR）：使用 PaddleOCR 在本地进行推理，不将图片发送至任何外部 API</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>AI 服务商处理完成后，我们不保留您的文本内容；AI 服务商自身的留存策略以其隐私政策为准</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>您可以随时在设置中关闭 AI 功能，关闭后相关文本不会发送至任何外部服务</span>
              </li>
            </ul>
          </section>

          {/* 四 */}
          <section>
            <h3 className="text-base font-normal tracking-wide text-gray-700 mb-3">
              四、登录与会话
            </h3>
            <ul className="space-y-2 list-none pl-0">
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>MindOS 采用邮箱 + 密码注册登录，密码由身份认证服务（Supabase Auth）以加盐哈希形式加密存储，不以明文形式保存</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>登录成功后，通过加密签名的会话令牌（JWT）维持登录状态，令牌存于浏览器 Cookie 并仅在 HTTPS 下传输</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>连续多次输错密码将触发临时锁定；会话令牌定期自动轮换续期</span>
              </li>
            </ul>
          </section>

          {/* 五 */}
          <section>
            <h3 className="text-base font-normal tracking-wide text-gray-700 mb-3">
              五、第三方服务
            </h3>
            <ul className="space-y-2 list-none pl-0">
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>飞书：如您主动授权同步飞书文档，应用通过飞书 OAuth 获取您指定的文档内容，仅作为中间通道拉取，不存储、不分享</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>Obsidian：如您导入 Obsidian 笔记，内容仅在本地处理，不传输至任何服务器</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>微信公众号文章：如您输入文章链接，应用仅抓取文章正文用于知识提取，不存储原文</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>我们不向任何第三方出售、分享或泄露您的数据</span>
              </li>
            </ul>
          </section>

          {/* 六 */}
          <section>
            <h3 className="text-base font-normal tracking-wide text-gray-700 mb-3">
              六、PWA 与离线存储
            </h3>
            <ul className="space-y-2 list-none pl-0">
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>MindOS 以 PWA（渐进式 Web 应用）形式运行，Service Worker 会缓存应用静态资源以支持离线访问</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>缓存仅包含应用代码和界面资源，不包含您的任何个人内容数据</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>您可以通过浏览器设置清除 Service Worker 缓存和 IndexedDB 数据</span>
              </li>
            </ul>
          </section>

          {/* 七 */}
          <section>
            <h3 className="text-base font-normal tracking-wide text-gray-700 mb-3">
              七、您的权利
            </h3>
            <ul className="space-y-2 list-none pl-0">
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>查看权：您的数据全部存储在本地 IndexedDB 中，随时可查看</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>删除权：任何数据均可通过设置页逐模块一键清除</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>导出权：设置页提供数据导出功能，可导出全部数据为 JSON 格式</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>卸载即清空：卸载 APP 或清除浏览器数据将删除所有本地数据，且无法恢复</span>
              </li>
            </ul>
          </section>

          {/* 八 */}
          <section>
            <h3 className="text-base font-normal tracking-wide text-gray-700 mb-3">
              八、未成年人保护
            </h3>
            <ul className="space-y-2 list-none pl-0">
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>如果您未满 14 周岁，请在监护人陪同下阅读本协议并使用本应用</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>我们不会主动收集未成年人的个人信息；如发现误收集，将及时删除</span>
              </li>
            </ul>
          </section>

          {/* 九 */}
          <section>
            <h3 className="text-base font-normal tracking-wide text-gray-700 mb-3">
              九、免责声明与责任限制
            </h3>
            <ul className="space-y-2 list-none pl-0">
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>本应用按"现状"提供服务，不对 AI 生成内容的准确性、完整性和适用性做出保证</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>AI 功能生成的反馈、标签、洞见等内容仅供参考，不构成任何专业建议</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>因不可抗力（包括但不限于 AI 服务商故障、网络中断）导致的服务中断，我们不承担责任</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>您应自行妥善保管登录密码；因密码泄露导致的数据风险由您自行承担</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>您对本应用的使用需遵守所在国家/地区的法律法规</span>
              </li>
            </ul>
          </section>

          {/* 十 */}
          <section>
            <h3 className="text-base font-normal tracking-wide text-gray-700 mb-3">
              十、协议更新
            </h3>
            <ul className="space-y-2 list-none pl-0">
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>我们可能不时更新本协议，更新后会在本页面重新标注更新日期</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>如更新内容涉及您的核心权利，我们会在应用内显著位置通知您</span>
              </li>
              <li className="flex gap-2">
                <span className="text-gray-300 select-none">•</span>
                <span>继续使用本应用即视为您同意更新后的协议</span>
              </li>
            </ul>
          </section>

          {/* 联系 */}
          <section className="border-t border-black/5 pt-8">
            <p className="text-sm text-gray-400 italic">
              如果您对本协议有任何疑问，请通过应用内设置页面的反馈渠道与我们联系。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
