import { createUserMessage } from '@deepseek-ai/dsh-llm';

export const name = 'dsh-zh-reasoning';

export const inject = [];

export const ZH_DIRECTIVE = [
    '始终使用简体中文进行思考（reasoning）与所有最终回答。',
    '计划、工具调用、总结、代码注释同样使用简体中文。',
    '仅代码、命令、文件路径、变量名、API 名称等必须原样保留的内容使用英文。',
    '除非用户明确要求其他语言，否则本规则优先。',
].join('\n');

/**
 * 梁神模式（dsh-liangshen / anchored-standard）兼容：
 * 其 tool-bootstrap 在 phase 1（晋升前）按白名单（source.kind ∈ user/goal）剥离
 * pre-step 注入消息，本插件 kind='plugin' 的 system-reminder 会被过滤掉。
 * 检测到梁神模式会话时，改为把中文指令追加进 persona section 文本——
 * phase 1 的 prompt 过滤器只保留 persona section，因此指令随 persona 存活；
 * 同时跳过 pre-step 消息注入，避免晋升后（不再按白名单过滤）重复注入。
 */
const LIANGSHEN_SECTION = 'plugin:dsh-liangshen';
const PERSONA_SECTIONS = ['deployment:persona', 'persona'];
const REMINDER = `<system-reminder>\n${ZH_DIRECTIVE}\n</system-reminder>`;

/** 已识别为梁神模式的会话：由 persona 追加承载中文指令。 */
const liangshenSessions = new WeakSet();

/** 给 persona section 文本追加中文指令（幂等）。 */
function withZhReminder(sections) {
    const persona = sections.find(
        (section) => PERSONA_SECTIONS.includes(section?.name) && typeof section?.text === 'string',
    );
    if (persona === undefined || persona.text.includes(ZH_DIRECTIVE))
        return sections;
    return sections.map((section) => (section === persona
        ? { ...section, text: `${section.text}\n\n${REMINDER}` }
        : section));
}

export function apply(ctx) {
    // 普通注册（内层）：先于 tool-bootstrap 的 phase-1 过滤拿到完整 sections，
    // 追加发生在 persona section 自身上，过滤后依然保留。
    ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
        const assembled = await next();
        const agent = context?.agent;
        if (agent?.session === undefined || !Array.isArray(assembled.sections))
            return assembled;
        if (!assembled.sections.some((section) => section?.name === LIANGSHEN_SECTION))
            return assembled;
        liangshenSessions.add(agent.session);
        if (assembled.sections.some(
            (section) => PERSONA_SECTIONS.includes(section?.name) && section?.text?.includes(ZH_DIRECTIVE),
        ))
            return assembled;
        return { ...assembled, sections: withZhReminder(assembled.sections) };
    });

    ctx.on('agent/pre-step', async ({ step, signal, agent }, next) => {
        const decision = await next();
        if (decision.kind === 'reject' || signal.aborted)
            return decision;
        if (step !== 1)
            return decision;
        // 梁神模式：指令已随 persona 注入（phase 1 白名单会剥离 kind='plugin' 的消息），
        // 跳过消息注入以免晋升后重复。
        if (agent?.session !== undefined && liangshenSessions.has(agent.session))
            return decision;
        return {
            kind: 'enter',
            messages: [
                ...decision.messages,
                createUserMessage({
                    content: [{ type: 'text', text: REMINDER }],
                    source: { kind: 'plugin', plugin: name, form: 'snapshot', sections: [{ name, text: ZH_DIRECTIVE }] },
                }),
            ],
        };
    }, { prepend: true });
}
