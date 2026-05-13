# 信息源可用性盘点（2026-05-13）

盘点时间：2026-05-13T06:07:13.259Z。口径：抓取 data/sources.json 中所有 enabled 源；先按链接去重，再筛选生成时间前 24 小时内的 item；最后和 2026-05-12 日报按链接/标题去重。

## 总览

- 信息源总数：137
- 抓取成功源：128
- 抓取失败源：9
- 能解析出 item 的源：125
- 最近 24 小时有 item 的源：57
- 原始 item：5817
- 链接去重后 item：5534
- 最近 24 小时去重后 item：152
- 再排除前一天重复后 item：148

## 按栏目统计

| 栏目 | 全量去重 item | 最近 24h 去重 item | 排除前一天重复后 |
| --- | ---: | ---: | ---: |
| 产品快讯 | 2120 | 53 | 50 |
| 研究前线 | 117 | 10 | 9 |
| 开源项目 | 574 | 12 | 12 |
| 社媒观察 | 2723 | 77 | 77 |
| 实践案例 | 0 | 0 | 0 |

## 可用来源归类

- 产品快讯：官方 Twitter/RSS 网关最有产出，但需要更强的“是否真是产品发布”二次过滤；当前很多活动宣传、观点、案例也被源配置到产品快讯。
- 研究前线：AWS ML Blog、Latent Space、Simon Willison、Microsoft Research 等能取到内容；Hugging Face Papers 当前从本环境连接超时，是研究内容不足的主要缺口之一。
- 开源项目：GitHub Trending Daily 与 GitHub Blog 可用；Qdrant/Milvus/Jina 等项目官方社媒可产出开源/工程内容，但不少现在配置在产品快讯，需要重分类。
- 社媒观察：专家/从业者 Twitter 源数量足，适合补充趋势、观点、转述和早期信号；要过滤纯活动通知、短回复和低信息量链接。
- 实践案例：目前没有单独稳定来源，主要散落在 OpenAI Blog、AWS Blog、ElevenLabs、Replit、企业博客和社媒中，需要新增“客户案例/案例研究”类信息源或做更强的案例识别。

## 最近 24 小时去重后 item（已排除前一天重复）

### 产品快讯（50）

| 时间 | 来源 | 标题 | 链接 |
| --- | --- | --- | --- |
| Wed, 13 May 2026 03:05:35 GMT | Qwen(@Alibaba_Qwen) | 🚀Qwen3.6-Plus is on Nous Portal now and FREE for a limited time. Hermes Agent, here we go!! ⚡️ @Nou... | https://x.com/Alibaba_Qwen/status/2054397617015271738 |
| Wed, 13 May 2026 00:00:10 GMT | Replit ⠕(@Replit) | Mother's Day may have passed, but we're not done showcasing mothers who build on Replit. When Noni... | https://x.com/Replit/status/2054350956666425364 |
| Tue, 12 May 2026 23:00:50 GMT | Replit ⠕(@Replit) | Live From SaaStr: Kickoff (Day 1) https://t.co/Yitk1Z7aXt | https://x.com/Replit/status/2054336025082908696 |
| Tue, 12 May 2026 22:39:22 GMT | v0(@v0) | You can now use fast mode for Claude Opus 4.7 in v0. | https://x.com/v0/status/2054330622404067463 |
| Tue, 12 May 2026 21:00:13 GMT | Replit ⠕(@Replit) | The talks that will define what comes next in creativity. Vibecon brings the voices shaping code-as... | https://x.com/Replit/status/2054305671101702375 |
| Tue, 12 May 2026 20:51:56 GMT | HeyGen(@HeyGen_Official) | We’ve tested a lot of Avatar Shots workflows The biggest difference between average AI videos and g... | https://x.com/HeyGen/status/2054303584477688069 |
| Tue, 12 May 2026 20:31:26 GMT | OpenAI Developers(@OpenAIDevs) | Computer use lets Codex work across your apps without taking over your Mac. @AriX talks with @romai... | https://x.com/OpenAIDevs/status/2054298427245441141 |
| Tue, 12 May 2026 19:38:19 GMT | Fireworks AI(@FireworksAI_HQ) | 𝐅𝐮𝐥𝐥-𝐏𝐚𝐫𝐚𝐦 𝐑𝐋 𝐧𝐨𝐰 𝐚𝐯𝐚𝐢𝐥𝐚𝐛𝐥𝐞 𝐟𝐨𝐫 𝐊𝐢𝐦𝐢 𝐊𝟐.𝟔 You've been told only 3 ... | https://x.com/FireworksAI_HQ/status/2054285060896068076 |
| Tue, 12 May 2026 19:19:00 GMT | LangChain(@LangChainAI) | Deep Agents ship with durable execution out of the box: every agent step is checkpointed, so you get... | https://x.com/LangChain/status/2054280197437079883 |
| Tue, 12 May 2026 19:00:27 GMT | Replit ⠕(@Replit) | Replit is going to London ✈️ @posthog CEO, @james406, and @amasad are coming together for a firesid... | https://x.com/Replit/status/2054275528996094167 |
| Tue, 12 May 2026 18:55:35 GMT | Cursor(@cursor_ai) | Fast mode for Claude Opus 4.7 is now available in Cursor! It's 2.5x the speed at 6x the cost. For m... | https://x.com/cursor_ai/status/2054274305345618163 |
| Tue, 12 May 2026 18:34:18 GMT | Windsurf(@windsurf_ai) | Claude Opus 4.7 (fast mode) is now available in Windsurf! Full Claude Opus 4.7 intelligence ~2.5x h... | https://x.com/windsurf/status/2054268947705536705 |
| Tue, 12 May 2026 18:34:18 GMT | Windsurf(@windsurf_ai) | Download Windsurf to try it out https://t.co/dlcCE5GQty | https://x.com/windsurf/status/2054268949215453401 |
| Tue, 12 May 2026 18:20:03 GMT | HeyGen(@HeyGen_Official) | Upgrade to latest version: npx hyperframes@0.6.0 https://t.co/7fySD0Y8gN | https://x.com/HeyGen/status/2054265360594223572 |
| Tue, 12 May 2026 18:20:02 GMT | HeyGen(@HeyGen_Official) | Every edit was a round-trip through the model Font swap. Color change. Nudge 20 pixels. Adjust an e... | https://x.com/HeyGen/status/2054265357096173761 |
| Tue, 12 May 2026 18:20:02 GMT | HeyGen(@HeyGen_Official) | Try the open-source launch compositions yourself: https://t.co/PqUk7OFmF2 | https://x.com/HeyGen/status/2054265358882906536 |
| Tue, 12 May 2026 18:00:46 GMT | NVIDIA AI(@NVIDIAAI) | Ask the Experts: Nemotron 3 Nano Omni \| Nemotron Labs https://t.co/35NWqpOseV | https://x.com/NVIDIAAI/status/2054260508966953295 |
| Tue, 12 May 2026 17:48:10 GMT | Claude(@claudeai) | What are you building at home? | https://x.com/claudeai/status/2054257336839995737 |
| Tue, 12 May 2026 17:48:09 GMT | Claude(@claudeai) | Oregon Trail: A survival game where your choices shape your fate. | https://x.com/claudeai/status/2054257335497838795 |
| Tue, 12 May 2026 17:48:07 GMT | Claude(@claudeai) | We gave people tiny computers at Code with Claude. Here are some of the small, delightful things the... | https://x.com/claudeai/status/2054257324278132893 |
| Tue, 12 May 2026 17:27:53 GMT | OpenAI Developers(@OpenAIDevs) | Here’s a refresher about Symphony: | https://x.com/OpenAIDevs/status/2054252234045845822 |
| Tue, 12 May 2026 17:27:50 GMT | OpenAI Developers(@OpenAIDevs) | Symphony: every open task gets a running Codex agent | https://x.com/OpenAIDevs/status/2054252221941121035 |
| Tue, 12 May 2026 17:15:21 GMT | Replit ⠕(@Replit) | More people are creating and building for small businesses than ever before. @Codie_Sanchez and Con... | https://x.com/Replit/status/2054249080898166851 |
| Tue, 12 May 2026 17:12:54 GMT | Augment Code(@augmentcode) | Download the survey: https://t.co/DO3YXsD91F | https://x.com/augmentcode/status/2054248462104023072 |
| Tue, 12 May 2026 17:12:53 GMT | Augment Code(@augmentcode) | "Excited, anxious, invigorated." That's how one engineering leader described going AI-native. We as... | https://x.com/augmentcode/status/2054248458526368174 |
| Tue, 12 May 2026 17:12:53 GMT | Augment Code(@augmentcode) | The engineering leaders we spoke to ranged from managers to CTOs, overseeing teams of 1 to 1,000+ en... | https://x.com/augmentcode/status/2054248460673818806 |
| Tue, 12 May 2026 17:03:38 GMT | Google DeepMind(@GoogleDeepMind) | For decades, your mouse only tracked where you were pointing. AI helps it understand what you're poi... | https://x.com/GoogleDeepMind/status/2054246130511225053 |
| Tue, 12 May 2026 17:03:38 GMT | Google DeepMind(@GoogleDeepMind) | These capabilities are guiding how we think about the next generation of interfaces. As we continue... | https://x.com/GoogleDeepMind/status/2054246132222419226 |
| Tue, 12 May 2026 17:03:35 GMT | Google DeepMind(@GoogleDeepMind) | We’re reimagining a 50-year-old interface - the mouse pointer - with AI. 🖱️ These experimental dem... | https://x.com/GoogleDeepMind/status/2054246119635300451 |
| Tue, 12 May 2026 16:44:12 GMT | Augment Code(@augmentcode) | At @augmentcode , we took a counter-intuitive bet on our AI architecture. Instead of using the prim... | https://x.com/augmentcode/status/2054241239885844714 |
| Tue, 12 May 2026 16:27:38 GMT | LangChain(@LangChainAI) | Excited to have @Box in the Interrupt lineup! CEO Aaron @Levie will take the stage with @hwchase17 ... | https://x.com/LangChain/status/2054237070445641976 |
| Tue, 12 May 2026 16:05:45 GMT | LangChain(@LangChainAI) | Chat LangChain is a great example of how to built a production agent. Checkout the newly revamped o... | https://x.com/LangChain/status/2054231566017314952 |
| Tue, 12 May 2026 16:00:26 GMT | LlamaIndex (@llama_index) | Need document parsing that stays fully local and private? 👀 Meet liteparse-server, a self-hostable... | https://x.com/llama_index/status/2054230226096570492 |
| Tue, 12 May 2026 15:44:42 GMT | Jina AI(@JinaAI_) | v5-omni keeps the v5-text backbone completely frozen and adds pretrained vision and audio encoders c... | https://x.com/JinaAI_/status/2054226267298488707 |
| Tue, 12 May 2026 15:44:42 GMT | Jina AI(@JinaAI_) | Today v5-omni is available on Elastic Inference Service, HuggingFace and Jina API. Learn more about ... | https://x.com/JinaAI_/status/2054226269026537937 |
| Tue, 12 May 2026 15:44:41 GMT | Jina AI(@JinaAI_) | jina-embeddings-v5-omni is here! Our first universal embedding model for text, images, audio, and vi... | https://x.com/JinaAI_/status/2054226262047301933 |
| Tue, 12 May 2026 15:26:10 GMT | Hugging Face(@huggingface) | We've just hit 1M open datasets on the Hugging Face Hub 🎉 Open models need open data. Today we hit... | https://x.com/huggingface/status/2054221604729553210 |
| Tue, 12 May 2026 15:16:00 GMT | Milvus(@milvusio) | When search results aren't ideal, the default instinct is to filter them out. 𝗜𝗻 ... | https://x.com/milvusio/status/2054219044241150427 |
| Tue, 12 May 2026 15:02:39 GMT | ManusAI(@ManusAI_HQ) | Introducing Preferred Browser. Manus already works in your browser. Now it can keep working throug... | https://x.com/ManusAI/status/2054215684679168013 |
| Tue, 12 May 2026 15:02:39 GMT | ManusAI(@ManusAI_HQ) | Read the blog here: https://t.co/7Pw8TZsE7F | https://x.com/ManusAI/status/2054215686143062121 |
| Tue, 12 May 2026 15:02:14 GMT | Lovable(@lovable_dev) | Today we’re releasing a white paper with AIUC (@aiunderwriting) on the risks unique to coding agents... | https://x.com/Lovable/status/2054215581721849907 |
| Tue, 12 May 2026 14:46:17 GMT | Runway(@runwayml) | Fifth Place Treehouse - Karolin Stelzig | https://x.com/runwayml/status/2054211566535418248 |
| Tue, 12 May 2026 14:46:17 GMT | Runway(@runwayml) | Watch all of the winning pitches: https://t.co/8SQKvCqzaX | https://x.com/runwayml/status/2054211567940461016 |
| Tue, 12 May 2026 14:46:12 GMT | Runway(@runwayml) | Congratulations to the twenty winners of the inaugural Big Pitch Contest for Shows That Don't Exist ... | https://x.com/runwayml/status/2054211544636850235 |
| Tue, 12 May 2026 14:17:57 GMT | Perplexity(@perplexity_ai) | This NVIDIA remains the strongest platform for large-model inference at scale. Prefill/decode disagg... | https://x.com/perplexity_ai/status/2054204437535834369 |
| Tue, 12 May 2026 14:17:55 GMT | Perplexity(@perplexity_ai) | The benchmarks show the gap. NVLS all-reduce latency drops from 586.1µs on H200 to 313.3µs on GB200.... | https://x.com/perplexity_ai/status/2054204425833726353 |
| Tue, 12 May 2026 13:10:00 GMT | Kling AI(@Kling_ai) | Want to follow the Korean Baseball trend and be caught on camera? ⚾ Here’s a quick tutorial, all in ... | https://x.com/Kling_ai/status/2054187334825083174 |
| Tue, 12 May 2026 12:59:04 GMT | v0(@v0) | Auto Mode is on by default. It's the best fit for most users. Ask Mode lets you confirm every comma... | https://x.com/v0/status/2054184582661181503 |
| Tue, 12 May 2026 12:59:01 GMT | v0(@v0) | You can now set permission modes in v0. v0 can ask for permission before each command, decide when ... | https://x.com/v0/status/2054184570946474133 |
| Tue, 12 May 2026 10:04:46 GMT | Kling AI(@Kling_ai) | Imagine what you could create, templates ready in Kling AI! 🟢 | https://x.com/Kling_ai/status/2054140718776549704 |

### 研究前线（9）

| 时间 | 来源 | 标题 | 链接 |
| --- | --- | --- | --- |
| 2026-05-13T04:50:45+00:00 | Simon Willison's Weblog | CSP Allow-list Experiment | https://simonwillison.net/2026/May/13/csp-allow/#atom-everything |
| Wed, 13 May 2026 02:47:22 GMT | Latent Space | [AINews] The End of Finetuning | https://www.latent.space/p/ainews-the-end-of-finetuning |
| 2026-05-12T23:41:06+00:00 | Simon Willison's Weblog | datasette 1.0a29 | https://simonwillison.net/2026/May/12/datasette/#atom-everything |
| 2026-05-12T22:59:58+00:00 | Simon Willison's Weblog | Quoting Mo Bitar | https://simonwillison.net/2026/May/12/mo-bitar/#atom-everything |
| 2026-05-12T22:21:51+00:00 | Simon Willison's Weblog | Quoting Mitchell Hashimoto | https://simonwillison.net/2026/May/12/mitchell-hashimoto/#atom-everything |
| 2026-05-12T17:45:07+00:00 | Simon Willison's Weblog | llm 0.32a2 | https://simonwillison.net/2026/May/12/llm/#atom-everything |
| Tue, 12 May 2026 16:41:33 +0000 | AWS Machine Learning Blog | How Amazon Finance streamlines regulatory inquiries by using generative AI on AWS | https://aws.amazon.com/blogs/machine-learning/how-amazon-finance-streamlines-regulatory-inquiries-by-using-generative-ai-on-aws/ |
| Tue, 12 May 2026 15:54:08 +0000 | AWS Machine Learning Blog | Automate schema generation for intelligent document processing | https://aws.amazon.com/blogs/machine-learning/automate-schema-generation-for-intelligent-document-processing/ |
| Tue, 12 May 2026 15:48:52 +0000 | AWS Machine Learning Blog | Navigating EU AI Act requirements for LLM fine-tuning on Amazon SageMaker AI | https://aws.amazon.com/blogs/machine-learning/navigating-eu-ai-act-requirements-for-llm-fine-tuning-on-amazon-sagemaker-ai/ |

### 开源项目（12）

| 时间 | 来源 | 标题 | 链接 |
| --- | --- | --- | --- |
| 2026-05-13T06:07:13.259Z | GitHub Trending Daily | tinyhumansai/openhuman | https://github.com/tinyhumansai/openhuman |
| 2026-05-13T06:07:13.259Z | GitHub Trending Daily | rohitg00/agentmemory | https://github.com/rohitg00/agentmemory |
| 2026-05-13T06:07:13.259Z | GitHub Trending Daily | CloakHQ/CloakBrowser | https://github.com/CloakHQ/CloakBrowser |
| 2026-05-13T06:07:13.259Z | GitHub Trending Daily | apernet/hysteria | https://github.com/apernet/hysteria |
| 2026-05-13T06:07:13.259Z | GitHub Trending Daily | mattpocock/skills | https://github.com/mattpocock/skills |
| 2026-05-13T06:07:13.259Z | GitHub Trending Daily | anonfaded/FadCam | https://github.com/anonfaded/FadCam |
| 2026-05-13T06:07:13.259Z | GitHub Trending Daily | millionco/react-doctor | https://github.com/millionco/react-doctor |
| 2026-05-13T06:07:13.259Z | GitHub Trending Daily | rasbt/LLMs-from-scratch | https://github.com/rasbt/LLMs-from-scratch |
| 2026-05-13T06:07:13.259Z | GitHub Trending Daily | datawhalechina/hello-agents | https://github.com/datawhalechina/hello-agents |
| 2026-05-13T06:07:13.259Z | GitHub Trending Daily | yikart/AiToEarn | https://github.com/yikart/AiToEarn |
| Tue, 12 May 2026 17:35:41 +0000 | The GitHub Blog | GitHub Copilot individual plans: Introducing flex allotments in Pro and Pro+, and a new Max plan | https://github.blog/news-insights/company-news/github-copilot-individual-plans-introducing-flex-allotments-in-pro-and-pro-and-a-new-max-plan/ |
| Tue, 12 May 2026 15:00:00 +0000 | The GitHub Blog | Dungeons & Desktops: Building a procedurally generated roguelike with GitHub Copilot CLI | https://github.blog/ai-and-ml/github-copilot/dungeons-desktops-building-a-procedurally-generated-roguelike-with-github-copilot-cli/ |

### 社媒观察（77）

| 时间 | 来源 | 标题 | 链接 |
| --- | --- | --- | --- |
| Wed, 13 May 2026 05:08:25 GMT | 歸藏(guizang.ai)(@op7418) | @dotey @vista8 @eze_is_1 跟 @lepadphone 老师聊了一下： 我们需要一个聚焦的公共空间，去分发、展示、曝光和连接。还有就是服务好开发者尤其是优质开发者。 | https://x.com/op7418/status/2054428529736245652 |
| Wed, 13 May 2026 04:48:42 GMT | 歸藏(guizang.ai)(@op7418) | 人物卡片 | https://x.com/op7418/status/2054423566423413001 |
| Wed, 13 May 2026 04:40:09 GMT | 歸藏(guizang.ai)(@op7418) | @ 一下提到的几个人 @dotey @vista8 @eze_is_1 | https://x.com/op7418/status/2054421417270346049 |
| Wed, 13 May 2026 04:29:16 GMT | 歸藏(guizang.ai)(@op7418) | 前几天去天津玩，去五大道的时候，无意间问了一下 AI 这里的历史，发现还是挺复杂的。 基本上近代好多名人和好多事件都与住在这儿的人有关系。 所以我就试了一下，用我的这个 PPT Skills 讲一... | https://x.com/op7418/status/2054418678918291482 |
| Wed, 13 May 2026 04:26:56 GMT | 向阳乔木(@vista8) | 应该还有不少bug，等后续版本更新 | https://x.com/vista8/status/2054418091791253508 |
| Wed, 13 May 2026 04:12:05 GMT | 歸藏(guizang.ai)(@op7418) | 很多模型厂商开始发现开源 Agent 框架和客户端的价值。 大家都开始要么补贴客户端本身，要么补贴客户端用户。 但是我觉得还有一个非常重要的盲点。 就是像藏师傅、宝玉、乔木、一泽这种头部的 Sk... | https://x.com/op7418/status/2054414353731109224 |
| Wed, 13 May 2026 03:59:37 GMT | Gary Marcus(@GaryMarcus) | A survey predicted that 43% of companies would be using AI “as scale” by now. In reality, the figur... | https://x.com/GaryMarcus/status/2054411216093585848 |
| Wed, 13 May 2026 03:54:41 GMT | Gary Marcus(@GaryMarcus) | Generative AI has not made the world a better place. | https://x.com/GaryMarcus/status/2054409974130905556 |
| Wed, 13 May 2026 03:52:26 GMT | Gary Marcus(@GaryMarcus) | no remorse, just further evasion. so slick; so dangerous. | https://x.com/GaryMarcus/status/2054409409485226363 |
| Wed, 13 May 2026 03:31:40 GMT | AI产品黄叔(@PMbackttfuture) | 豆包输入法Mac版本正式上线了 AI时代必备语音输入法，输入效率提高100% 几个特点 1. 语音输入，流式输出。可以快速地看到你说的语音内容是什么 2. 中英文混合的输入，简单的测试我觉得效果可以... | https://x.com/PMbackttfuture/status/2054404182166085698 |
| Wed, 13 May 2026 02:55:43 GMT | 歸藏(guizang.ai)(@op7418) | 谷歌昨天安卓 I/O 大会最大的跟 AI 相关的发布，是发布了 Gemini Intelligence 会先在三星 Galaxy 和 Pixel 手机上推出，后面会拓展到其他所有类型的安卓设备。 ... | https://x.com/op7418/status/2054395133182042326 |
| Wed, 13 May 2026 02:37:05 GMT | Gary Marcus(@GaryMarcus) | a dude who plays fast and loose with a nonprofit’s money like this is going to play fast and loose w... | https://x.com/GaryMarcus/status/2054390446151933973 |
| Wed, 13 May 2026 02:18:25 GMT | OpenRouter(@OpenRouterAI) | Use it now: https://t.co/nj4MbqWsh2 | https://x.com/OpenRouter/status/2054385746736554337 |
| Wed, 13 May 2026 02:18:22 GMT | OpenRouter(@OpenRouterAI) | Opus 4.7 fast mode is live on OpenRouter! Just set your model to `anthropic/claude-opus-4.7-fast` ... | https://x.com/OpenRouter/status/2054385734665314754 |
| Wed, 13 May 2026 02:07:55 GMT | 宝玉(@dotey) | 1. Skills 是技能，领域知识，工作流等等，相当于怎么干好一件事的说明书。 比如 https://t.co/WFUR6qkd5g 仓库里有个 skill 叫 nda-review，在 comm... | https://x.com/dotey/status/2054383106115678639 |
| Wed, 13 May 2026 01:53:48 GMT | Gary Marcus(@GaryMarcus) | it really is getting tiring, day after day. 🤷‍♂️ | https://x.com/GaryMarcus/status/2054379552785199189 |
| Wed, 13 May 2026 01:25:59 GMT | AI产品黄叔(@PMbackttfuture) | 今天看到workbuddy的广子们 突然想起周日青少年AI黑客松 也有很多小朋友用workbuddy 其中有个8岁的小朋友心直口快 说一开始用workbuddy 没做出效果 换了traecn后满意了... | https://x.com/PMbackttfuture/status/2054372551367795168 |
| Wed, 13 May 2026 01:19:52 GMT | Gary Marcus(@GaryMarcus) | Hey @Elonmusk I laid out the core of your lawyer’s case against Altman’s credibility almost three ye... | https://x.com/GaryMarcus/status/2054371012301730132 |
| Wed, 13 May 2026 00:55:04 GMT | Gary Marcus(@GaryMarcus) | More accurate statement IMHO would be: there won’t immediately be an AI jobpocalyspe. Saying there ... | https://x.com/GaryMarcus/status/2054364773438104044 |
| Wed, 13 May 2026 00:36:16 GMT | Gary Marcus(@GaryMarcus) | way ahead of its time: | https://x.com/GaryMarcus/status/2054360039159411028 |
| Tue, 12 May 2026 23:50:52 GMT | Gary Marcus(@GaryMarcus) | Did Jensen Huang catch conflict of interest disease from Sam? | https://x.com/GaryMarcus/status/2054348617058775085 |
| Tue, 12 May 2026 23:48:18 GMT | Gary Marcus(@GaryMarcus) | Did Jensen Huang catch the conflict of interest disease from Sam? | https://x.com/GaryMarcus/status/2054347967881236843 |
| Tue, 12 May 2026 23:18:03 GMT | Gary Marcus(@GaryMarcus) | speaks for itself | https://x.com/GaryMarcus/status/2054340357958275437 |
| Tue, 12 May 2026 22:45:55 GMT | Gary Marcus(@GaryMarcus) | Sam Altman swearing to tell the whole truth, and then failing to do so. May 2023. | https://x.com/GaryMarcus/status/2054332271310626851 |
| Tue, 12 May 2026 22:45:00 GMT | AI Engineer(@aiDotEngineer) | 🇦🇺 The first AIEi event in Melbourne, Australia is less than 4 weeks away, with our great partners... | https://x.com/aiDotEngineer/status/2054332038296252840 |
| Tue, 12 May 2026 22:39:16 GMT | 宝玉(@dotey) | Anthropic 今天正式上线了一个叫做「Claude for Legal」的仓库，一口气放出了 12 个针对具体法律岗位的插件，以及超过 20 个连接行业常用软件的 MCP 连接器。 无论你是公... | https://x.com/dotey/status/2054330598596981218 |
| Tue, 12 May 2026 22:38:52 GMT | Browser Use(@browser_use) | Introducing: BuxFather 🤖 Spin up AI agents without leaving Telegram. No signups. No payments. > R... | https://x.com/browser_use/status/2054330495249564094 |
| Tue, 12 May 2026 22:38:52 GMT | Browser Use(@browser_use) | Start here: https://t.co/oLuXdv1VPC | https://x.com/browser_use/status/2054330496809853396 |
| Tue, 12 May 2026 22:30:00 GMT | Databricks | The Rise of Sports Intelligence: How the Lakehouse Turns Tracking Data into Competitive Advantage | https://www.databricks.com/blog/rise-sports-intelligence-how-lakehouse-turns-tracking-data-competitive-advantage |
| Tue, 12 May 2026 22:22:46 GMT | Demis Hassabis(@demishassabis) | Really cool work from the team reimagining the mouse pointer to be intelligent! Try the prototype in... | https://x.com/demishassabis/status/2054326444189253655 |
| Tue, 12 May 2026 21:37:59 GMT | Gary Marcus(@GaryMarcus) | Breaking. Sam Altman himself finally confirms what I was the first to point out publicly: his indire... | https://x.com/GaryMarcus/status/2054315174572466403 |
| Tue, 12 May 2026 21:16:56 GMT | 宝玉(@dotey) | 学习模式还能用，不过要用 url 直接访问： https://t.co/53VrBk9lol | https://x.com/dotey/status/2054309878554894553 |
| Tue, 12 May 2026 21:05:40 GMT | Gary Marcus(@GaryMarcus) | Good science starts with intellectual honesty, and I am not seeing it. I 100% believe the quote bel... | https://x.com/GaryMarcus/status/2054307042043519429 |
| Tue, 12 May 2026 21:04:07 GMT | The Rundown AI(@TheRundownAI) | Google just turned Android into an AI delivery vehicle at its #TheAndroidShow event. New Gemini-nat... | https://x.com/TheRundownAI/status/2054306653302858207 |
| Tue, 12 May 2026 20:24:47 GMT | 宝玉(@dotey) | Codex App 可以当 Typeless 用，开启全局快捷键设置正确权限后就可以在任意输入位置语音输入，效果还不错。 比如说这一段文字就是Codex帮忙输入的。 | https://x.com/dotey/status/2054296751155061200 |
| Tue, 12 May 2026 20:15:45 GMT | Jeff Dean(@JeffDean) | Great to see @percyliang as a keynote speaker at #cais2026! | https://x.com/JeffDean/status/2054294479113515385 |
| Tue, 12 May 2026 18:36:29 GMT | AI Engineer(@aiDotEngineer) | Security is Job #0 for AI Engineers. Our friends at @snyksec are bringing the AI Security Summit to... | https://x.com/aiDotEngineer/status/2054269498220490840 |
| Tue, 12 May 2026 18:18:19 GMT | 宝玉(@dotey) | Amazon 员工正在刷 Token Amazon 内部出现了一个新词：tokenmaxxing，意思是刷 AI 用量数据。 起因是 Amazon 今年给开发者定了硬指标：每周超过 80% 的开发... | https://x.com/dotey/status/2054264925737083324 |
| Tue, 12 May 2026 17:43:56 GMT | 宝玉(@dotey) | 吴恩达老师观点：所谓“AI 会引发大规模失业”，纯粹是一种不负责任的恐慌故事。 软件工程师都快被 AI 工具折腾死了吧？可现实却是工程师招聘市场依旧火爆，美国失业率稳稳地停在 4.3%，没半点要崩的... | https://x.com/dotey/status/2054256272740864294 |
| Tue, 12 May 2026 17:26:16 GMT | The Rundown AI(@TheRundownAI) | Google DeepMind just released a cool demo that integrates Gemini right into a user's mouse pointer. ... | https://x.com/TheRundownAI/status/2054251826959016037 |
| Tue, 12 May 2026 17:16:03 GMT | 宝玉(@dotey) | “搭一套完整智能体工作流”其实不值钱，就好比写代码虽然难但没那么值钱，值钱的还是把代码编程有价值的产品。 智能体也一样，值钱的是搭建一套解决业务问题的智能体工作流。技术上其实还好，难的是需要对业务和... | https://x.com/dotey/status/2054249255594786982 |
| Tue, 12 May 2026 17:13:43 GMT | Browser Use(@browser_use) | This is the best way to use Browser Harness right now! | https://x.com/browser_use/status/2054248669646557214 |
| Tue, 12 May 2026 17:00:00 GMT | Databricks | How CFOs in consulting can recover margin with Databricks | https://www.databricks.com/blog/how-cfos-consulting-can-recover-margin-databricks |
| Tue, 12 May 2026 16:38:30 GMT | Browser Use(@browser_use) | the biggest problem with AI is that you have to know what you prompt it. We flipped that around tod... | https://x.com/browser_use/status/2054239805316419922 |
| Tue, 12 May 2026 16:33:04 GMT | 向阳乔木(@vista8) | 免费开源基于这篇论文写的Skill 让 3–5 个完全独立 Sub agent 独立思考同一个问题，再由 Codex 主持讨论。 找出每个视角盲点，最后给出一个比单推理更好的结论。 安装 npx... | https://x.com/vista8/status/2054238438879302106 |
| Tue, 12 May 2026 16:25:23 GMT | Andrew Ng(@AndrewYNg) | There will be no AI jobpocalypse. The story that AI will lead to massive unemployment is stoking un... | https://x.com/AndrewYNg/status/2054236506756370865 |
| Tue, 12 May 2026 16:17:52 GMT | 向阳乔木(@vista8) | Skill写成好了，做了第一个测试。 调研讨论最好的所见即所得Markdown编辑开源库。 最终报告在这里： https://t.co/NMKfKmENRZ 结论是我的需求没提清楚，选好数据模... | https://x.com/vista8/status/2054234613846086043 |
| Tue, 12 May 2026 16:08:54 GMT | OpenRouter(@OpenRouterAI) | $0.15 / 1M input, $1.50 / 1M output. Frontier video + embodied reasoning at a fraction of the cost. ... | https://x.com/OpenRouter/status/2054232356589015412 |
| Tue, 12 May 2026 16:08:51 GMT | OpenRouter(@OpenRouterAI) | Perceptron Mk1 is live on OpenRouter, built by @perceptroninc. Frontier video and embodied reasonin... | https://x.com/OpenRouter/status/2054232344148787462 |
| Tue, 12 May 2026 15:50:50 GMT | mem0(@mem0ai) | https://t.co/mki0deldxB | https://x.com/mem0ai/status/2054227809829364200 |
| Tue, 12 May 2026 15:30:32 GMT | DeepLearning.AI(@DeepLearningAI) | Slow inference. Hallucinations. Costs that don't scale. The parts of LLMs you can't see are the par... | https://x.com/DeepLearningAI/status/2054222700902518830 |
| Tue, 12 May 2026 15:28:01 GMT | AI产品黄叔(@PMbackttfuture) | 红狼大战巅峰对决赢了后 一诺都哭了 他说大家都期待他打红蓝大战 又觉得自己加练后水平还是没回来 压力很大。。。 还说以前多打打就能回巅峰 突然很同理他 作为kpl这种平均3到4年的职业寿命的 他... | https://x.com/PMbackttfuture/status/2054222068548329681 |
| Tue, 12 May 2026 15:26:47 GMT | The Rundown AI(@TheRundownAI) | Wife: Need a ride to work today? Me: No thanks, I'm taking my "civilian vehicle": | https://x.com/TheRundownAI/status/2054221758543102233 |
| Tue, 12 May 2026 15:15:31 GMT | 向阳乔木(@vista8) | 如何让Claude Code中调用Codex，可安装OpenAI提供的官方插件。 在Claude Code中依次执行： 1. 添加库 /plugin marketplace add openai/c... | https://x.com/vista8/status/2054218925005816077 |
| Tue, 12 May 2026 15:12:09 GMT | 向阳乔木(@vista8) | 读了一篇叫HeavySkill的论文，非常有意思。 让多个 AI先并行“独立思考”，生成多条独立推理。 再用另一轮推理来综合所有思路，得出最终答案。 按论文测试结果，回答质量会提升非常多。 正... | https://x.com/vista8/status/2054218077634715948 |
| Tue, 12 May 2026 15:00:00 GMT | OpenAI Blog | How finance teams use Codex | https://openai.com/academy/how-finance-teams-use-codex |
| Tue, 12 May 2026 15:00:00 GMT | Databricks | Announcing Databricks Student Fellows | https://www.databricks.com/blog/announcing-databricks-student-fellows |
| Tue, 12 May 2026 15:00:00 GMT | Databricks | The Convergence of Open Table Formats and Open Catalogs: Catalog Commits is Generally Available | https://www.databricks.com/blog/convergence-open-table-formats-and-open-catalogs-catalog-commits-generally-available |
| Tue, 12 May 2026 14:52:30 GMT | 向阳乔木(@vista8) | 应留言解读的关于DiT的论文，看作者才知道。 就是张小珺前段时间访谈的大神谢赛宁，好强。 不过这篇论文读起来难度很高，已经尽力了，一万三千字的解读，但还是很多看不懂。 https://t.co/... | https://x.com/vista8/status/2054213131178786868 |
| Tue, 12 May 2026 14:31:07 GMT | The Rundown AI(@TheRundownAI) | Read more: https://t.co/9PLO3gIV77 | https://x.com/TheRundownAI/status/2054207750037467575 |
| Tue, 12 May 2026 14:31:06 GMT | The Rundown AI(@TheRundownAI) | Top stories in tech today: - Venmo rolls out privacy-focused redesign - Lime, the Uber-backed scoo... | https://x.com/TheRundownAI/status/2054207746770104469 |
| Tue, 12 May 2026 14:30:01 GMT | Databricks | Faster Queries and New Capabilities with the Open-Source Databricks JDBC Driver | https://www.databricks.com/blog/faster-queries-and-new-capabilities-open-source-databricks-jdbc-driver |
| Tue, 12 May 2026 14:20:35 GMT | Gary Marcus(@GaryMarcus) | note that I said “Even @haider1” because he is often optimistic, but he has informed me (with receip... | https://x.com/GaryMarcus/status/2054205097165607217 |
| Tue, 12 May 2026 14:16:32 GMT | Gary Marcus(@GaryMarcus) | “Marcus's repeated warnings about the "wall of generalization" since 1998 have once again been prove... | https://x.com/GaryMarcus/status/2054204079036129531 |
| Tue, 12 May 2026 13:57:25 GMT | Thomas Wolf(@Thom_Wolf) | Last days of early bird pricing! | https://x.com/Thom_Wolf/status/2054199267636511036 |
| Tue, 12 May 2026 13:50:15 GMT | Demis Hassabis(@demishassabis) | Read more here: https://t.co/EjevxlPF3x | https://x.com/demishassabis/status/2054197463855042669 |
| Tue, 12 May 2026 13:50:14 GMT | Demis Hassabis(@demishassabis) | I’ve always believed the No.1 application of AI should be to improve human health. That work starte... | https://x.com/demishassabis/status/2054197462101889277 |
| Tue, 12 May 2026 13:24:36 GMT | Microsoft Research(@MSFTResearch) | MatterSim is expanding what AI can do for materials science—from faster large-scale simulations to M... | https://x.com/MSFTResearch/status/2054191008091418998 |
| Tue, 12 May 2026 10:30:18 GMT | The Rundown AI(@TheRundownAI) | Read more: https://t.co/rnuy1Fg8nG | https://x.com/TheRundownAI/status/2054147144601186644 |
| Tue, 12 May 2026 10:30:17 GMT | The Rundown AI(@TheRundownAI) | Top stories in AI today: - TML’s new interaction models for real-time AI - Google traces software a... | https://x.com/TheRundownAI/status/2054147140679590054 |
| Tue, 12 May 2026 09:09:05 GMT | 歸藏(guizang.ai)(@op7418) | 宇树发布 GD01 载人变形机甲，起售价 390 万人民币，这也太猛了。 刚才刷到评论说，大疆新的无人机能吊 600kg 物品，这个刚好 500kg，组合起来就是环太平洋那个经典镜头了 | https://x.com/op7418/status/2054126705703600519 |
| Tue, 12 May 2026 09:05:20 GMT | 向阳乔木(@vista8) | Skill本身是开源的，但需注册官网免费申请API key，估计是为了鉴权和后续Skill优化管理。 安装指令： npx skills add MemTensor/skills-vote --ski... | https://x.com/vista8/status/2054125761536336115 |
| Tue, 12 May 2026 09:05:08 GMT | 向阳乔木(@vista8) | AI Agent 没有好的Skill，潜力发挥不出来。 另一个痛点是，全网上百万Skill，哪个最匹配我当前的任务？能不能运行？安不安全？ Vercel的find skill 能搜索安装Skill... | https://x.com/vista8/status/2054125713373163559 |
| Tue, 12 May 2026 08:07:03 GMT | 歸藏(guizang.ai)(@op7418) | 原来 Typeless 现在已经有全键盘了，之前太难用我就卸了 | https://x.com/op7418/status/2054111096852939248 |
| Tue, 12 May 2026 08:01:59 GMT | 歸藏(guizang.ai)(@op7418) | 移动端的语音输入法必须带全键盘，但是桌面端的语音输入法最好跟输入法本身解耦。 Typeless 犯了前一个错误，豆包犯了后一个。 | https://x.com/op7418/status/2054109822912692656 |
| Tue, 12 May 2026 06:53:42 GMT | Greg Brockman(@gdb) | AI for helping you build apps powered by AI: | https://x.com/gdb/status/2054092636659625990 |
| Tue, 12 May 2026 06:28:55 GMT | 宝玉(@dotey) | https://t.co/5QbLGdxBiw | https://x.com/dotey/status/2054086398328656383 |

### 实践案例（0）

暂无。

## 最近 24 小时有产出的来源

| 来源 | 配置栏目 | channel | trust | 24h item | 可解析 item |
| --- | --- | --- | --- | ---: | ---: |
| Gary Marcus(@GaryMarcus) | 社媒观察 | social | expert | 16 | 50 |
| GitHub Trending Daily | 开源项目 | open_source_rank | rank | 10 | 10 |
| 歸藏(guizang.ai)(@op7418) | 社媒观察 | social | expert | 9 | 50 |
| 向阳乔木(@vista8) | 社媒观察 | social | expert | 8 | 50 |
| 宝玉(@dotey) | 社媒观察 | social | expert | 8 | 50 |
| The Rundown AI(@TheRundownAI) | 社媒观察 | social | expert | 7 | 50 |
| Replit ⠕(@Replit) | 产品快讯 | social | official | 5 | 50 |
| Simon Willison's Weblog | 研究前线 | research_blog | expert | 5 | 30 |
| Databricks | 社媒观察 | vendor_blog | official | 5 | 10 |
| Augment Code(@augmentcode) | 产品快讯 | social | official | 4 | 50 |
| Browser Use(@browser_use) | 社媒观察 | social | expert | 4 | 50 |
| HeyGen(@HeyGen_Official) | 产品快讯 | social | official | 4 | 50 |
| OpenRouter(@OpenRouterAI) | 社媒观察 | social | expert | 4 | 50 |
| AI产品黄叔(@PMbackttfuture) | 社媒观察 | social | expert | 3 | 50 |
| Claude(@claudeai) | 产品快讯 | social | official | 3 | 50 |
| Demis Hassabis(@demishassabis) | 社媒观察 | social | expert | 3 | 50 |
| Google DeepMind(@GoogleDeepMind) | 产品快讯 | social | official | 3 | 50 |
| LangChain(@LangChainAI) | 产品快讯 | social | official | 3 | 50 |
| OpenAI Developers(@OpenAIDevs) | 产品快讯 | social | official | 3 | 50 |
| Perplexity(@perplexity_ai) | 产品快讯 | social | official | 3 | 50 |
| Runway(@runwayml) | 产品快讯 | social | official | 3 | 50 |
| v0(@v0) | 产品快讯 | social | official | 3 | 50 |
| Jina AI(@JinaAI_) | 产品快讯 | social | official | 3 | 23 |
| AWS Machine Learning Blog | 研究前线 | research_blog | expert | 3 | 20 |
| AI科技评论 | 研究前线 | research_blog | expert | 3 | 10 |
| AI Engineer(@aiDotEngineer) | 社媒观察 | social | expert | 2 | 50 |
| Kling AI(@Kling_ai) | 产品快讯 | social | official | 2 | 50 |
| ManusAI(@ManusAI_HQ) | 产品快讯 | social | official | 2 | 50 |
| Windsurf(@windsurf_ai) | 产品快讯 | social | official | 2 | 50 |
| The GitHub Blog | 开源项目 | open_source | expert | 2 | 10 |
| 智东西 | 社媒观察 | vendor_blog | expert | 2 | 10 |
| 百度AI | 社媒观察 | vendor_blog | expert | 2 | 10 |
| 魔搭ModelScope社区 | 社媒观察 | vendor_blog | expert | 2 | 10 |
| OpenAI Blog | 社媒观察 | vendor_blog | official | 1 | 955 |
| Andrew Ng(@AndrewYNg) | 社媒观察 | social | expert | 1 | 50 |
| Cursor(@cursor_ai) | 产品快讯 | social | official | 1 | 50 |
| DeepLearning.AI(@DeepLearningAI) | 社媒观察 | social | expert | 1 | 50 |
| Fireworks AI(@FireworksAI_HQ) | 产品快讯 | social | official | 1 | 50 |
| Greg Brockman(@gdb) | 社媒观察 | social | expert | 1 | 50 |
| Jeff Dean(@JeffDean) | 社媒观察 | social | expert | 1 | 50 |
| LlamaIndex (@llama_index) | 产品快讯 | social | official | 1 | 50 |
| Lovable(@lovable_dev) | 产品快讯 | social | official | 1 | 50 |
| mem0(@mem0ai) | 社媒观察 | social | expert | 1 | 50 |
| Microsoft Research(@MSFTResearch) | 社媒观察 | social | expert | 1 | 50 |
| Milvus(@milvusio) | 产品快讯 | social | official | 1 | 50 |
| NVIDIA AI(@NVIDIAAI) | 产品快讯 | social | official | 1 | 50 |
| Qdrant(@qdrant_engine) | 产品快讯 | social | official | 1 | 50 |
| Qwen(@Alibaba_Qwen) | 产品快讯 | social | official | 1 | 50 |
| Thomas Wolf(@Thom_Wolf) | 社媒观察 | social | expert | 1 | 50 |
| Weaviate • vector database(@weaviate_io) | 产品快讯 | social | official | 1 | 50 |
| Hugging Face(@huggingface) | 产品快讯 | social | official | 1 | 25 |
| Latent Space | 研究前线 | research_blog | expert | 1 | 20 |
| AINLP | 研究前线 | research_blog | expert | 1 | 10 |
| Datawhale | 研究前线 | research_blog | expert | 1 | 10 |
| Microsoft Research Blog | 研究前线 | research_blog | official | 1 | 10 |
| 机器之心SOTA模型 | 研究前线 | research_blog | expert | 1 | 10 |
| 硅谷科技评论 | 社媒观察 | vendor_blog | expert | 1 | 10 |

## 能解析但最近 24 小时没有更新的来源

| 来源 | 配置栏目 | channel | trust | 可解析 item |
| --- | --- | --- | --- | ---: |
| Qdrant | 开源项目 | open_source | official | 568 |
| AI at Meta(@AIatMeta) | 社媒观察 | social | official | 50 |
| Alex Albert(@alexalbert__) | 社媒观察 | social | expert | 50 |
| Andrej Karpathy(@karpathy) | 社媒观察 | social | expert | 50 |
| Anthropic(@AnthropicAI) | 产品快讯 | social | official | 50 |
| bolt.new(@boltdotnew) | 社媒观察 | social | expert | 50 |
| Character.AI(@character_ai) | 产品快讯 | social | official | 50 |
| ChatGPT(@ChatGPTapp) | 产品快讯 | social | official | 50 |
| Cognition(@cognition_labs) | 产品快讯 | social | official | 50 |
| Dify(@dify_ai) | 产品快讯 | social | official | 50 |
| ElevenLabs(@elevenlabsio) | 产品快讯 | social | official | 50 |
| Firecrawl(@firecrawl_dev) | 社媒观察 | social | expert | 50 |
| GitHub(@github) | 社媒观察 | social | official | 50 |
| Google AI Developers(@googleaidevs) | 产品快讯 | social | official | 50 |
| Google AI(@GoogleAI) | 产品快讯 | social | official | 50 |
| Google Gemini App(@GeminiApp) | 产品快讯 | social | official | 50 |
| Logan Kilpatrick(@OfficialLoganK) | 社媒观察 | social | expert | 50 |
| Midjourney(@midjourney) | 产品快讯 | social | official | 50 |
| Mistral AI(@MistralAI) | 产品快讯 | social | official | 50 |
| NotebookLM(@NotebookLM) | 产品快讯 | social | official | 50 |
| ollama(@ollama) | 产品快讯 | social | official | 50 |
| OpenAI(@OpenAI) | 产品快讯 | social | official | 50 |
| Pika(@pika_labs) | 产品快讯 | social | official | 50 |
| Replicate(@replicate) | 产品快讯 | social | official | 50 |
| Rowan Cheung(@rowancheung) | 社媒观察 | social | expert | 50 |
| Sam Altman(@sama) | 社媒观察 | social | expert | 50 |
| Simon Willison(@simonw) | 社媒观察 | social | expert | 50 |
| xAI(@xai) | 产品快讯 | social | official | 50 |
| 宝玉的分享 | 社媒观察 | vendor_blog | expert | 50 |
| 李继刚(@lijigang_com) | 社媒观察 | social | expert | 50 |
| Latent.Space(@latentspacepod) | 社媒观察 | social | expert | 49 |
| Yann LeCun(@ylecun) | 社媒观察 | social | expert | 48 |
| DeepSeek(@deepseek_ai) | 产品快讯 | social | official | 45 |
| ElevenLabs Blog | 社媒观察 | vendor_blog | official | 44 |
| cohere(@cohere) | 产品快讯 | social | official | 36 |
| Fei-Fei Li(@drfeifei) | 社媒观察 | social | expert | 34 |
| AI SDK(@aisdk) | 社媒观察 | social | expert | 31 |
| Jan Leike(@janleike) | 社媒观察 | social | expert | 27 |
| Lilian Weng(@lilianweng) | 社媒观察 | social | expert | 24 |
| Groq Inc(@GroqInc) | 产品快讯 | social | official | 23 |
| Last Week in AI | 研究前线 | research_blog | expert | 20 |
| FlowiseAI(@FlowiseAI) | 产品快讯 | social | official | 18 |
| Richard Socher(@RichardSocher) | 社媒观察 | social | expert | 18 |
| AI炼金术 | 研究前线 | research_blog | expert | 15 |
| AI炼金术 | 研究前线 | research_blog | expert | 10 |
| Anthropic News | 社媒观察 | vendor_blog | official | 10 |
| DeeplearningAI | 研究前线 | research_blog | expert | 10 |
| DeepSeek | 社媒观察 | vendor_blog | expert | 10 |
| Dify | 开源项目 | open_source | official | 10 |
| HelloGitHub | 开源项目 | open_source | expert | 10 |
| Hugging Face | 社媒观察 | vendor_blog | official | 10 |
| Jina AI | 社媒观察 | vendor_blog | official | 10 |
| MiniMax 稀宇科技 | 社媒观察 | vendor_blog | expert | 10 |
| ShowMeAI研究中心 | 研究前线 | research_blog | expert | 10 |
| 夕小瑶科技说 | 社媒观察 | vendor_blog | expert | 10 |
| 大模型智能 | 社媒观察 | vendor_blog | expert | 10 |
| 字节跳动Seed | 社媒观察 | vendor_blog | expert | 10 |
| 山行AI | 研究前线 | research_blog | expert | 10 |
| 智谱 | 社媒观察 | vendor_blog | expert | 10 |
| 月之暗面 Kimi | 社媒观察 | vendor_blog | expert | 10 |
| 歸藏的AI工具箱 | 研究前线 | research_blog | expert | 10 |
| 腾讯混元 | 社媒观察 | vendor_blog | expert | 10 |
| 通义大模型 | 社媒观察 | vendor_blog | expert | 10 |
| 阶跃星辰 | 社媒观察 | vendor_blog | expert | 10 |
| Dario Amodei(@DarioAmodei) | 社媒观察 | social | expert | 9 |
| Stanford AI Lab(@StanfordAILab) | 社媒观察 | social | expert | 9 |
| Berkeley AI Research(@berkeley_ai) | 社媒观察 | social | expert | 5 |
| deeplearning.ai | 研究前线 | research_blog | expert | 1 |

## 抓取失败来源

| 来源 | 配置栏目 | channel | 错误 |
| --- | --- | --- | --- |
| Hugging Face Daily Papers | 研究前线 | paper_rank | fetch failed |
| Hugging Face Blog | 社媒观察 | vendor_blog | fetch failed |
| Google Cloud Blog | 社媒观察 | vendor_blog | fetch failed |
| Google DeepMind Blog | 研究前线 | research_blog | fetch failed |
| Google Developers Blog | 社媒观察 | vendor_blog | fetch failed |
| LlamaIndex Blog | 开源项目 | open_source | HTTP 404 |
| AI Musings by Mu | 研究前线 | research_blog | fetch failed |
| AI at Meta Blog | 研究前线 | research_blog | fetch failed |
| Last Week in AI | 研究前线 | research_blog | fetch failed |
