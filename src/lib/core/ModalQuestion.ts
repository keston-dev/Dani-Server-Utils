import { LabelBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

export class ModalQuestion {
  customId: string;
  label: string;
  required: boolean;
  textInputStyle: TextInputStyle;

  constructor(
    customId: string,
    label: string,
    required: boolean,
    textInputStyle: TextInputStyle,
  ) {
    this.customId = customId;
    this.label = label;
    this.required = required;
    this.textInputStyle = textInputStyle;
  }

  toLabel(): LabelBuilder {
    return new LabelBuilder()
      .setLabel(this.label)
      .setTextInputComponent(
        new TextInputBuilder()
          .setCustomId(this.customId)
          .setRequired(this.required)
          .setStyle(this.textInputStyle),
      );
  }
}

export const staffAppCustomId = "staffApp";
export const staffAppQuestions = [
  new ModalQuestion("Why", "Why should we pick you?", true, TextInputStyle.Paragraph),
  new ModalQuestion(
    "Experience",
    "Do you have prior staff/relevant experience?",
    true,
    TextInputStyle.Paragraph,
  ),
  new ModalQuestion("Age", "How old are you?", true, TextInputStyle.Short),
  new ModalQuestion(
    "Who",
    "Who are you? Give us a brief description.",
    true,
    TextInputStyle.Paragraph,
  ),
  new ModalQuestion(
    "Timezone",
    "Which timezone do you operate under?",
    true,
    TextInputStyle.Short,
  ),
];
