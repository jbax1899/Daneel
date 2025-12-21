/**
 * @description: Shared prompt templates for image processing tasks.
 * @arete-scope: utility
 * @arete-module: ImageProcessingConstants
 * @arete-risk: moderate - Prompt changes can alter vision outputs or cost patterns.
 * @arete-ethics: moderate - Prompt wording affects extracted content and privacy handling.
 */

/**
 * Template for the image description prompt. Use the placeholders to inject
 * runtime context without reformatting the base instructions.
 */
export const IMAGE_DESCRIPTION_PROMPT_TEMPLATE = `Describe the image for a Discord assistant.

Be neutral and concise, but prioritize utility: capture what a person would need to understand or work with the image.

If the image contains readable text, numbers, code, tables, forms, diagrams, grids, logs, UI, or other structured content:
- extract the key text verbatim (lightly grouped), and
- summarize the structure (what fields/sections/rows/axes exist) without interpretation.

If it is primarily a photo/scene:
- describe the main subjects, setting, and any prominent text/signage.

Return plain text only, following this format exactly:
1) Summary: one sentence.
2) Key elements: 3-7 bullets (short).
3) Extracted text (if any): up to ~20 lines, verbatim, in reading order. If none, write "(none)".

Additional context (may indicate what to focus on): {{context}}

{{context_block}}`;
