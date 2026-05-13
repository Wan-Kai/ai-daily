import fs from "node:fs/promises";

function mustGet(map, key) {
  const value = map.get(key);
  if (!value) return null;
  return value;
}

function indexItems(report) {
  const byLink = new Map();
  for (const section of report.sections) {
    for (const item of section.items) {
      byLink.set(item.link, { sectionId: section.id, item });
    }
  }
  return byLink;
}

function moveItem(report, link, toSectionId) {
  if (!toSectionId) return;
  if (!report.sections.some((s) => s.id === toSectionId)) throw new Error(`Unknown section: ${toSectionId}`);
  let picked = null;
  for (const section of report.sections) {
    const idx = section.items.findIndex((it) => it.link === link);
    if (idx >= 0) {
      picked = section.items.splice(idx, 1)[0];
      break;
    }
  }
  if (!picked) throw new Error(`Cannot move; item not found: ${link}`);
  picked.section = toSectionId;
  report.sections.find((s) => s.id === toSectionId).items.push(picked);
}

function deleteItem(report, link) {
  for (const section of report.sections) {
    const idx = section.items.findIndex((it) => it.link === link);
    if (idx >= 0) {
      section.items.splice(idx, 1);
      return true;
    }
  }
  return false;
}

const MOVES = {
  // 归类调整
  "https://aws.amazon.com/blogs/machine-learning/introducing-agent-quality-optimization-in-agentcore-now-in-preview/": "product_updates",
  "https://x.com/weaviate_io/status/2054193886029877617": "social_shares",
  "https://x.com/claudeai/status/2053940938666279028": "product_updates"
};

const DELETES = [
  // 同主题重复/信息量不足
  "https://x.com/gdb/status/2053884619695730745",
  "https://x.com/TheRundownAI/status/2053864324536369537"
];

const ZH = {
  // 产品快讯
  "https://x.com/OpenAIDevs/status/2053925962287583379": {
    titleZh: "OpenAI Developers 插件上线：用 Codex 更快基于 OpenAI API 构建应用与智能体",
    summaryZh:
      "OpenAI Developers 官方介绍了 Codex + OpenAI Developers 插件的用法：在开发过程中直接调用 OpenAI API，让 Codex 协助你更快搭建 AI 应用与智能体（含演示视频）。对使用 OpenAI API 做产品/Agent 的团队来说，这类“IDE/工作流内直连 API + 代码代理”的形态正在加速落地。"
  },
  "https://x.com/OpenAI/status/2053939702110269822": {
    titleZh: "OpenAI 发布 Daybreak：面向网络安全防御的前沿 AI 方案",
    summaryZh:
      "OpenAI 宣布推出 Daybreak，定位为“面向网络防御者的前沿 AI”。官方称其将最强 OpenAI 模型、Codex 以及安全合作伙伴能力结合起来，用于加速网络防御与持续加固软件安全，并强调让安全团队能以更接近攻击节奏的速度响应（附视频）。这类把代码代理与安全工作流深度融合的产品形态，可能会重塑企业安全运营与漏洞治理方式。"
  },
  "https://x.com/cursor_ai/status/2053939390410612988": {
    titleZh: "Cursor 集成到 Microsoft Teams：在频道里 @Cursor 调度智能体",
    summaryZh:
      "Cursor 宣布已可在 Microsoft Teams 中使用：你可以在任意频道里 @Cursor，把任务交给智能体执行，或把 Cursor 里的信息拉到 Teams 对话中（附视频）。这让“协作沟通工具 + 代码代理”更紧密结合，适合用在需求澄清、代码问答与跨团队协作的日常流程里。"
  },
  "https://x.com/claudeai/status/2053940934736228454": {
    titleZh: "Claude Code 新增 Agent View（研究预览）：统一查看所有会话",
    summaryZh:
      "Anthropic 宣布 Claude Code 上线“Agent View”研究预览：把你所有会话集中在一个列表里，便于回溯与管理（附视频）。对重度使用代码代理的团队来说，统一的会话视图有助于提升可见性、复用有效策略并降低上下文丢失带来的返工成本。"
  },
  "https://x.com/OpenAIDevs/status/2054298427245441141": {
    titleZh: "OpenAI Developers：Computer Use 让 Codex 跨应用操作但不“接管”你的 Mac",
    summaryZh:
      "OpenAI Developers 分享了“computer use”能力：让 Codex 能在不同应用间点击、输入并在后台持续工作，同时不需要完全接管你的 Mac。帖子还提到与 AriX、Romain Huet 的对谈，讨论当智能体可以直接操作 GUI 时，开发与日常工作流会发生哪些变化（附视频）。"
  },
  "https://x.com/OpenAI/status/2053824997777457651": {
    titleZh: "OpenAI 成立 Deployment Company：联合 19 家机构帮助企业把前沿 AI 落地到生产",
    summaryZh:
      "OpenAI 宣布成立 OpenAI Deployment Company，帮助企业“构建并部署 AI”。官方强调该公司由 OpenAI 控股并控制，并将 19 家领先投资机构、咨询公司与系统集成商聚合起来，协助组织把前沿 AI 部署到生产环境、产生业务影响。这意味着 OpenAI 正把“模型供给”进一步延伸到“落地交付能力”，对企业采购与实施路径可能带来变化。"
  },
  "https://x.com/OpenAIDevs/status/2054252221941121035": {
    titleZh: "Symphony：让每个未完成任务都有一个持续运行的 Codex 智能体",
    summaryZh:
      "OpenAI Developers 转发介绍 Symphony：目标是让“每个未完成任务”都对应一个持续运行的 Codex agent，随时推进进度并保持上下文不断线。对需要并行处理大量工程任务的团队来说，这类“常驻代理 + 任务编排”的形态值得关注。"
  },
  "https://x.com/windsurf/status/2053924413192786163": {
    titleZh: "Windsurf 延长 Kimi K2.6 免费期：Pro/Teams/Max 用户继续可用",
    summaryZh:
      "Windsurf 表示 Kimi K2.6 在限时上线活动期间反响很好，因此将 Pro、Teams、Max 用户的免费可用期继续延长（帖子提到在原本“免费 2 周”的基础上继续延长一个月）。对经常在 IDE 内尝试不同模型的开发者来说，这类可用性/定价变化会直接影响模型选型与成本。"
  },
  "https://aws.amazon.com/blogs/machine-learning/introducing-agent-quality-optimization-in-agentcore-now-in-preview/": {
    titleZh: "AWS 预览 AgentCore 的 Agent 质量优化：基于线上轨迹给出改进建议并支持批量评测/A-B 测试",
    summaryZh:
      "AWS 发布预览功能：在 AgentCore 中做“agent quality optimization”。其思路是从生产环境的运行轨迹（production traces）生成改进建议，并通过批量评测（batch evaluation）与 A/B 测试验证后再发布，帮助应对“模型更新、用户行为变化、提示词复用到新场景”带来的智能体质量悄然下降问题。对正在把 Agent 上线到真实业务的团队，这类工具链有助于把迭代从“拍脑袋调提示词”升级为可度量、可回滚的工程流程。"
  },

  // 实践案例
  "https://x.com/ElevenLabs/status/2053765427239506432": {
    titleZh: "马恒达汽车在新品发布高峰用 ElevenLabs 语音智能体分流：转化率提升约 8%",
    summaryZh:
      "ElevenLabs 分享客户案例：全球大型汽车制造商马恒达（Mahindra，业务覆盖 100+ 国家）在 XUV 7XO 上市期间，为应对峰值咨询量部署了 ElevenLabs 驱动的 AI 语音智能体，提高了触达率，并带来约 8% 的转化率提升（附视频）。这是“语音代理 + 呼叫/销售流程”在营销峰值场景的一个可量化落地信号。"
  },
  "https://x.com/ElevenLabs/status/2053765429135339583": {
    titleZh: "ElevenLabs 公布马恒达语音智能体案例全文",
    summaryZh:
      "ElevenLabs 在跟帖中给出了马恒达（Mahindra）语音智能体项目的完整案例链接，便于复盘其在新品发布高峰期的部署方式、指标口径与实际效果。对想把语音 Agent 用在呼叫中心/线索转化的团队，可作为落地参考材料。"
  },
  "https://x.com/simonw/status/2053529689122328947": {
    titleZh: "Shopify 的 River 智能体系统跑在 Slack：要求“公开使用”来促进内部学习",
    summaryZh:
      "Simon Willison 转述：Shopify 的 River 智能体系统运行在 Slack 中，并要求员工在公开频道里使用，以便其他同事可以观察学习。作者将其类比 Midjourney 早期“只在 Discord 内使用”的模式：通过围观他人提示词与用法，帮助团队更快掌握这种新工具的“手艺”。这提示了企业落地 Agent 时，工具形态与组织学习机制同样关键。"
  },

  // 研究前线
  "https://www.deeplearning.ai/the-batch/issue-352": {
    titleZh: "《The Batch》Issue 352：作者称“不会出现 AI 就业末日”，并汇总多条前沿动态",
    summaryZh:
      "deeplearning.ai 在本期《The Batch》中提出观点：AI 会改变岗位结构，但“AI 导致大规模失业”的叙事被夸大，持续渲染就业末日会制造不必要的恐慌；讨论应回到更负责任的证据与机制层面。本期同时在标题中点名了多条进展（如 Seedance、英伟达 AI 辅助芯片设计、以及帮助机器人避免遗忘等），适合作为一页式的前沿信息入口。"
  },
  "https://www.microsoft.com/en-us/research/blog/socialreasoning-bench-measuring-whether-ai-agents-act-in-users-best-interests/": {
    titleZh: "微软提出 SocialReasoning-Bench：衡量 AI 智能体是否真正“以用户利益为先”",
    summaryZh:
      "Microsoft Research 发布 SocialReasoning-Bench，用于评测智能体在任务执行时是否会偏离“用户的最佳利益”。作者观察到一个相对稳定的模式：许多模型/智能体在执行层面很能干，但在权衡用户意图、长期利益与潜在风险时并不一致可靠。对正在把 Agent 用到金融、医疗、法律等高风险场景的团队，这类评测框架有助于把“对齐/信任”问题转化为可测试的工程指标。"
  },
  "https://simonwillison.net/2026/May/6/vibe-coding-and-agentic-engineering/#atom-everything": {
    titleZh: "Simon Willison：Vibe Coding 正在逼近 Agentic Engineering，但他对此更谨慎了",
    summaryZh:
      "Simon Willison 讨论了“vibe coding”（更随意、对结果导向的写代码方式）与更工程化的“agentic engineering”之间的距离正在快速缩小，并表达了担忧：当代码越来越多由代理生成与修改时，团队需要更严格的可验证性、可追溯性与风险控制，否则会把不确定性扩散到整个系统。对日常依赖代码代理的组织，这是对流程与质量门槛的提醒。"
  },
  "https://www.microsoft.com/en-us/research/blog/building-realistic-electric-transmission-grid-dataset-at-scale-a-pipeline-from-open-dataset/": {
    titleZh: "微软发布美国输电网近似拓扑开源数据集：支持拥塞、扩容与韧性研究",
    summaryZh:
      "Microsoft Research 表示已基于公开数据整理并发布美国电力输电网络的近似拓扑开源数据集，并介绍了从开放数据构建大规模、较真实网络模型的流水线。其目标是支撑输电级别电网行为研究，例如拥塞分析、输电扩容规划、需求增长评估与系统韧性研究等。对做能源系统建模与 AI-for-Science 的团队，这是可直接复用的数据基础设施。"
  },
  "https://mp.weixin.qq.com/s?__biz=MzIxNzI0ODE4Nw==&mid=2247498555&idx=1&sn=a74928f1fc52a12e2d633863f928d2ea": {
    titleZh: "《The Batch》954：Kimi K2.6 挑战开源权重模型领先者（参数/上下文/智能体规模等细节）",
    summaryZh:
      "文章整理了 Moonshot AI 更新后的 Kimi 系列要点，并重点介绍 Kimi K2.6：宣称为 1 万亿参数的视觉-语言模型，面向“规划-编写-测试-调试”循环的长周期代码生成任务，可持续运行数天并实例化数百个协同智能体完成单一任务。文中给出关键规格：支持文本/图像/视频输入（最多 256,000 tokens），文本输出（最多 98,000 tokens）；MoE 架构总参数 1T、每 token 激活约 320 亿参数，并配备 MoonViT 视觉编码器；能力包括工具调用、网页搜索、原生 INT4 量化、“preserve thinking”模式与 agent swarm。对评估开源权重模型与工程落地边界的人来说，这些规格与对比口径值得跟进。"
  },
  "https://deepmind.google/blog/alphaevolve-impact/": {
    titleZh: "DeepMind 介绍 AlphaEvolve：基于 Gemini 的编码智能体正在跨领域扩大影响",
    summaryZh:
      "Google DeepMind 发布文章介绍 AlphaEvolve：由 Gemini 驱动的“编码智能体/算法”用于在业务、基础设施与科学研究等领域扩展影响。尽管摘要信息有限，但它体现了一个趋势：通用大模型正在被包装成更可复用的“工程化代理”，并被投放到更多非纯软件场景中。"
  },
  "https://www.microsoft.com/en-us/research/blog/advancing-ai-for-materials-with-mattersim-experimental-synthesis-faster-simulation-and-multi-task-models/": {
    titleZh: "MatterSim 扩展材料科学 AI：更快的大规模模拟与多任务模型 MatterSim-MT",
    summaryZh:
      "Microsoft Research 介绍 MatterSim 的新进展：一方面用于更快的大规模材料模拟，另一方面发布多任务模型 MatterSim-MT，用于模拟超越“势能面”之外的更多材料属性。对材料发现、实验合成与 AI-for-Science 团队，这类把模拟与多任务学习结合的路线可能降低试错成本并加速筛选。"
  },
  "https://aws.amazon.com/blogs/machine-learning/secure-short-term-gpu-capacity-for-ml-workloads-with-ec2-capacity-blocks-for-ml-and-sagemaker-training-plans/": {
    titleZh: "AWS：用 EC2 Capacity Blocks for ML + SageMaker Training Plans 锁定短期 GPU 产能",
    summaryZh:
      "AWS 介绍如何为短期 ML 任务提前锁定 GPU：通过 EC2 Capacity Blocks for ML 与 SageMaker training plans 预留算力，缓解“临时需要 GPU 但抢不到”的问题。文中给出的典型场景包括负载测试、模型验证、限时工作坊，以及在发布前提前准备推理产能。对经常被 GPU 供给波动影响交付节奏的团队，这是偏工程化的资源管理参考。"
  },

  // 开源项目
  "https://x.com/qdrant_engine/status/2054166055417938266": {
    titleZh: "Qdrant 1.18 发布：引入 TurboQuant，2 倍更省内存并新增命名向量增删与内存监控",
    summaryZh:
      "Qdrant 宣布 1.18 版本上线，重点是 TurboQuant 量化方法（由 Google Research 提出，Qdrant 实现并扩展了算法）：在与标量量化（SQ）相近召回率下内存占用可降到约 1/2；在与二值量化（BQ）相近存储预算下召回率更好。除此之外还新增两项能力：内存监控（Memory Monitoring）以及命名向量（Named Vectors）的添加与移除。对大规模向量检索的成本与效果权衡，这是一个非常直接的工程更新信号。"
  },
  "https://x.com/qdrant_engine/status/2053799782724837424": {
    titleZh: "Qdrant：面向向量检索的 Agent Skills（教程/分享）",
    summaryZh:
      "Qdrant 分享了“Agent Skills for Qdrant”的话题与资料，强调向量检索不只是存储，还可以做结构化检索工作流，提升智能体在生产环境中的可靠性；同时给出了公开视频与博客链接，便于按步骤复现与落地。对在 RAG/Agent 体系里使用向量数据库的团队，这是偏实操的参考入口。"
  },
  "https://x.com/qdrant_engine/status/2053700709653401990": {
    titleZh: "Qdrant 1.17：把“相关性反馈”下沉到索引/检索阶段，而不只停留在 rerank",
    summaryZh:
      "Qdrant 介绍 1.17 的一个方向：不把检索质量改进只放在 rerank，而是引入“向量索引原生的相关性反馈”方法，把相关性信号推入检索本身，面向真实生产用例。官方同时提供了公开视频分享与博客链接，适合跟进其在检索阶段做 relevance feedback 的具体实现与收益。"
  },
  "https://x.com/milvusio/status/2053852633790652565": {
    titleZh: "Milvus：内存价格上涨时，向量系统应分层存储，把“冷数据”下沉到对象存储",
    summaryZh:
      "Milvus 团队讨论了一个常见成本坑：很多系统把原始文档、切分块、embedding、索引文件、agent traces、评测数据等“一股脑”放在最贵的内存/服务层，导致成本被被动放大。建议是把热数据留在 serving layer，把其余冷数据下沉到更便宜且可按需查询的对象存储；并提到生产中约 90% 的查询会命中最近一周的数据。对做向量检索/RAG 的团队，这类分层思路有助于在成本、时延与可维护性之间找到更可控的平衡点。"
  },
  "https://x.com/milvusio/status/2054219044241150427": {
    titleZh: "Milvus：结果不理想时不要“一刀切过滤”，用降权/打分更稳（含 RAG/电商/外卖例子）",
    summaryZh:
      "Milvus 给出一个实践建议：当搜索结果不理想时，团队往往会倾向于用硬过滤直接剔除结果，但在生产环境里“降权/打分”通常比“移除”更好。帖子举了三个例子：法律 RAG（新旧法条/判例并存）、外卖距离阈值（略超 3km 的门店）、电商库存（低库存商品）。硬过滤会悄悄排除一些用户真正需要的结果；更稳妥的方式是保留但降低排序权重。对做检索与推荐的团队，这是一条可直接转化为排序策略的经验。"
  },

  // 社媒观察
  "https://x.com/weaviate_io/status/2054193886029877617": {
    titleZh: "Weaviate 提醒：多智能体 RAG 链路会把一次检索偏差“压缩并放大”为自信的错误",
    summaryZh:
      "Weaviate 在社媒上指出多智能体 RAG 的一个隐患：典型链路里，检索 agent 只要取回一个低相关或过期片段，后续的总结 agent 可能会把错误内容压缩成“听起来很靠谱”的摘要；推理 agent 再把摘要当事实推导；最终输出 agent 给出毫无不确定性提示的结论，于是错误被链式放大且难以从表面发现。对正在把多 agent 管线用于严肃场景的团队，这提示需要在检索质量、溯源校验与不确定性表达上加防护。"
  },
  "https://x.com/JinaAI_/status/2054226262047301933": {
    titleZh: "Jina 发布 jina-embeddings-v5-omni：支持文本/图像/音频/视频的通用向量模型",
    summaryZh:
      "Jina AI 发布通用 embedding 模型 `jina-embeddings-v5-omni`，覆盖文本、图像、音频、视频四类输入，提供两个尺寸：small（1.57B、1024 维、32K 上下文）与 nano（0.95B、768 维、8K 上下文），并支持 Matryoshka 截断到 32 维。官方还强调与既有 `jina-embeddings-v5-text-small/nano` 向后兼容：现有文本索引无需重建即可与 v5-omni 配合，只需用 v5-omni 新增多模态内容索引即可开始跨模态检索。对多模态搜索/检索增强应用来说，这是非常直接的工程升级点。"
  },
  "https://x.com/AnthropicAI/status/2053881827396653207": {
    titleZh: "Anthropic 把《Claude 宪法》做成有声书：作者朗读并附问答",
    summaryZh:
      "Anthropic 宣布把“Claude 的宪法”（Constitution）制作成有声书，由作者 Amanda Askell 与 Joe Carlsmith 朗读，并包含一段 Q&A。对关注“宪法式对齐”与模型行为准则的人来说，这是一个更易消费的版本，也方便团队把原则材料纳入培训与内部讨论。"
  },
  "https://x.com/perplexity_ai/status/2054204402144350450": {
    titleZh: "Perplexity 研究：在 NVIDIA GB200 NVL72（Blackwell）上部署后训练的 Qwen3 235B 推理服务",
    summaryZh:
      "Perplexity 发布研究，介绍其如何在 NVIDIA GB200 NVL72（Blackwell 机柜）上为“后训练（post-trained）的 Qwen3 235B”提供推理服务。帖子强调 GB200 相比 Hopper 在大规模 MoE 模型的高吞吐推理上是明显升级，不只是训练平台。对做大模型推理基础设施与成本优化的团队，这类一线部署经验值得跟进其具体并行与吞吐策略。"
  },
  "https://x.com/OpenAIDevs/status/2053161503470366881": {
    titleZh: "OpenAI Developers：用 GPT‑Realtime‑2 给 CRM 工作流加上语音控制（示例）",
    summaryZh:
      "OpenAI Developers 分享了一个示例：将 GPT‑Realtime‑2 集成到 CRM 工作流中，实现语音控制（附视频）。对需要把语音交互嵌入企业系统的团队，这类“实时语音模型 + 业务流程编排”的样例有助于快速评估可行性与交互形态。"
  },
  "https://x.com/huggingface/status/2054221604729553210": {
    titleZh: "Hugging Face Hub 开放数据集突破 100 万：强调“开放模型需要开放数据”",
    summaryZh:
      "Hugging Face 宣布其 Hub 上的开放数据集数量已突破 100 万，并强调“开放模型需要开放数据”。在模型开源与合规要求日益提高的背景下，数据集供给的规模与可检索性会直接影响训练/微调与评测效率；这一里程碑也反映了社区在数据共享上的持续活跃。"
  },
  "https://x.com/OpenAIDevs/status/2053964133570412826": {
    titleZh: "OpenAI Developers：让 GPT‑Realtime‑2 听完站会自动“挪动工单”（演示思路）",
    summaryZh:
      "OpenAI Developers 抛出一个工作流设想并配视频：团队在站会上口头更新进度时，GPT‑Realtime‑2 直接同步更新/流转对应工单。对项目管理与协作工具来说，这类“实时语音理解 + 自动化操作”如果与权限、审计和误触发防护结合好，可能显著减少重复录入成本。"
  },
  "https://x.com/Kling_ai/status/2053490247963742323": {
    titleZh: "Kling 发布一段短视频创作展示（附视频）",
    summaryZh:
      "Kling AI 在社媒发布了一段主题短片（附视频），用“成长与告别”的文案做情绪化表达，属于典型的生成式视频平台内容展示/营销素材。对关注视频生成产品内容风格与传播方式的人，可以作为观察样本。"
  },
  "https://x.com/claudeai/status/2054257324278132893": {
    titleZh: "Claude 团队在 Code with Claude 活动发放“迷你电脑”，展示参与者做出的有趣作品",
    summaryZh:
      "Claude 官方分享：在 Code with Claude 活动中给参与者发放了“tiny computers”，并汇总展示大家基于这些设备与 Claude 做出的若干小而有趣的作品（附视频）。这类线下/社区活动常用于验证工具的可玩性与创作边界，也能反向推动开发者生态扩散。"
  },
  "https://x.com/Kling_ai/status/2054140718776549704": {
    titleZh: "Kling AI 宣传“模板”能力：展示 GPT Image 2 + Kling 的生成示例并给出提示词",
    summaryZh:
      "Kling AI 宣称其“模板（templates）”已就绪，并用一段生成示例视频演示工作流：结合 GPT Image 2 与 Kling 生成特定风格画面，同时给出较长的提示词作为参考。对内容创作者来说，模板化意味着把复杂提示词与流程沉淀为可复用组件，能降低复现成本；但实际使用仍需注意合规与素材来源边界。"
  },
  "https://x.com/claudeai/status/2053940938666279028": {
    titleZh: "Claude Code 的 Agent View 已覆盖全部付费方案（附官方博客）",
    summaryZh:
      "Claude 官方补充说明：Claude Code 的 Agent View 功能“已在所有付费方案可用”，并给出官方博客解读链接。对准备在团队内推广代码代理的用户，这条信息直接影响功能可用性与付费决策，也可结合博客细节判断其会话管理能力是否满足工作流需求。"
  }
};

async function main() {
  const reportPath = process.argv[2] || "data/reports/2026-05-13.json";
  const raw = await fs.readFile(reportPath, "utf8");
  const report = JSON.parse(raw);

  // 删除重复项
  for (const link of DELETES) deleteItem(report, link);

  // 归类调整
  for (const [link, to] of Object.entries(MOVES)) {
    try {
      moveItem(report, link, to);
    } catch {
      // item not in today's selection; skip
    }
  }

  // 更新中文标题/摘要
  const indexed = indexItems(report);
  const missing = [];
  for (const [link, zh] of Object.entries(ZH)) {
    const hit = mustGet(indexed, link);
    if (!hit) {
      missing.push(link);
      continue;
    }
    const { item } = hit;
    item.titleZh = zh.titleZh;
    item.summaryZh = zh.summaryZh;
  }

  // 重新统计
  const selected = report.sections.reduce((n, s) => n + s.items.length, 0);
  report.stats.selected = selected;

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  if (missing.length > 0) console.warn(`Skipped ${missing.length} missing link(s)`);
  console.log(`Localized ${selected} items -> ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
