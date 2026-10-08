import { describe, expect, it } from "vitest";
import MailComposer from "nodemailer/lib/mail-composer";
import { simpleParser } from "mailparser";
import { articleToDocx } from "./articleDocx";
import { readMail } from "./mailbox";

const docx = (title: string) =>
  articleToDocx({ title, html: `<p>Lees meer over <a href="https://klant.nl">tuinmeubelen</a>.</p>` });

describe("readMail", () => {
  it("reads every Word file, and says why an old .doc isn't read", async () => {
    const raw = await new MailComposer({
      from: "Klant <klant@klant.nl>",
      to: "seo@nugevonden.nl",
      subject: "Twee artikelen",
      text: "Hierbij twee artikelen.",
      attachments: [
        { filename: "woonidee.docx", content: await docx("Tuin in de herfst") },
        { filename: "digikeur.docx", content: await docx("Slim vergelijken") },
        { filename: "oud.doc", content: Buffer.from("oud"), contentType: "application/msword" },
      ],
    })
      .compile()
      .build();
    const mail = await readMail(await simpleParser(raw), ["woonidee.nl", "digikeur.nl"]);
    expect(mail.articles.map((a) => [a.fileName, a.title])).toEqual([
      ["woonidee.docx", "Tuin in de herfst"],
      ["digikeur.docx", "Slim vergelijken"],
    ]);
    expect(mail.articleTitle).toBe("Tuin in de herfst");
    expect(mail.fileNote).toContain("oud.doc is een oud Word-bestand");
  });
});
