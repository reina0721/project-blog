---
title: Idea · AI 伙伴
date: 2026-11-26
category: idea
summary: 想做一个能长期相处的 AI 伴侣。把角色的经历留在自己的存档里，把感知、认知和表达做成能接到不同地方的内核。
sample: false
---

我想做一个可以长期相处的 AI 伴侣。平时聊聊天，一起玩，也一起过些很普通的日子。今天关掉网页，隔几天换个地方见面，她怎么还是她？

## 实现方向：感知、认知、表达

一条消息进来，先过感知，再到认知，最后才决定怎么表达。我想把这三步拆成各自能复用的核心。

- **感知层（上行观察元语言与动态感官自知）`perception-core`**：内核不关心刺激来自哪里，只接收标准化的感知事件。无论是人类的对话、时间的推移、环境的变更还是未来的外部传感器信号，进入内核前都会被抽象成统一的感知输入。

- **大脑认知层（看不见的认知元内核与可插拔认知器官） `cognition-core`**：整个系统的唯一重心。它负责维护记忆、情绪、状态机、内部思考与决策逻辑。它不仅对外界输入做出反应，更能在交互间隙保持状态连续性，决定“要不要回应、怎么想、记住什么”。

- **内在表现层（下行沟通意图元语言、表达传递）`expression-core`**：大脑不直接拼接某个平台的专属消息格式，而是输出结构化的表达意图——包括语义内容、情绪倾向与行为动机。至于这段意图最终被渲染成一段文本、一句带语气的语音，还是一个动作指令，完全交给外部终端自行消费。

## 架构设计

`agent-core` 负责跑话轮、调模型和工具，`extension-core` 负责扩展的授权、启停、重载和故障隔离。认知负责判断，执行这一层也能拿去跑普通的 Agent 任务。

```mermaid
flowchart TD
    accTitle: ai0 九包架构
    accDescr: 箭头从被依赖的包指向使用它的包。

    Protocol["@ai0/protocol<br/>零内部依赖的协议契约<br/>扩展清单 Schema v2.0.0"]
    Extension["@ai0/extension-core<br/>扩展核 · ExtensionCoreHost<br/>defineFacetPoint · Cordis Fiber<br/>权限与故障隔离"]
    SDK["@ai0/sdk<br/>defineExtensionPackage<br/>跨核 FacetPoint"]
    Perception["@ai0/perception-core<br/>感知核 · UniversalObservationFrame<br/>感官覆盖桶 · PerceptionFilterPipeline"]
    Agent["@ai0/agent-core<br/>执行核 · Turn/Round 循环<br/>多模型来源 · agent.* 切面"]
    Expression["@ai0/expression-core<br/>表达核 · CommunicativeIntentEnvelope<br/>词表协商 · 降级 · 四态回执"]
    Storage["@ai0/storage<br/>SQLite WAL · 记忆血缘 DAG<br/>Hard Forget · 宿主模型池"]
    Cognition["@ai0/cognition-core<br/>认知核 · MVCC 五域协调<br/>默认空描述符状态引擎<br/>黑板编译 · W1～W4"]
    Gateway["@ai0/gateway<br/>ChannelProtocolGateway<br/>/protocol/v0/channel<br/>PrivilegedAdminServer"]

    Protocol --> SDK & Extension & Storage
    Extension --> SDK & Perception & Agent & Expression & Cognition & Gateway
    Perception ==> Cognition
    Perception --> Gateway
    Agent --> Cognition
    Expression ==> Cognition
    Expression --> Gateway
    Storage --> Cognition & Gateway
    Cognition ==> Gateway

    classDef infrastructure fill:#f6f8fc,stroke:#9aaec9,color:#213854,stroke-width:1.25px
    classDef runtime fill:#edf2ff,stroke:#7891bd,color:#243e67,stroke-width:1.5px
    classDef interaction fill:#dceaff,stroke:#5278b6,color:#193967,stroke-width:1.75px
    classDef cognition fill:#263e74,stroke:#1d325d,color:#ffffff,stroke-width:2px
    class Protocol,SDK,Storage,Gateway infrastructure
    class Agent,Extension runtime
    class Perception,Expression interaction
    class Cognition cognition
```

## 仓库

> 缺少、Agent、项目开发经验，设计存在不足。

[`项目地址 · github.com/reina0721/ai0`](https://github.com/reina0721/ai0)
