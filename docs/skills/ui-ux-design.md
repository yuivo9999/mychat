# MyChat UI/UX Design Skill

This is the design contract behind the optional **UI/UX Skill** runtime switch.

The skill makes the model act as a product designer, UI designer, UX designer, mobile/Android designer, and UI reviewer when the switch is enabled.

Runtime flow:

**Understand → IA → Design System → Interaction states → Responsive/Android → Implement → UI Review → Fix**

The runtime prompt is exported from `src/services/uiUxSkill.ts`. The switch is conversation-level through `ModelParameters.uiUxSkill`, alongside Context7 in the **运行参数** panel.

The skill is deliberately optional. When disabled, normal coding behavior is unchanged.
