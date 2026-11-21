import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

import { AdminReaderManager } from "@/components/admin-reader-manager";
import { PersonalCenter } from "@/components/personal-center";

describe("account management interfaces", () => {
  it("shows the personal profile, private placeholders, and three account tabs", () => {
    const markup = renderToStaticMarkup(createElement(PersonalCenter, {
      initialProfile: {
        id: "reader-id",
        email: "reader@example.test",
        displayName: "Reader",
        role: "reader",
        phone: null,
        gender: null,
        introduction: null,
        createdAt: new Date("2024-03-02T00:00:00.000Z"),
        avatarKey: null,
      },
    }));

    expect(markup).toContain("基础信息");
    expect(markup).toContain("修改邮箱");
    expect(markup).toContain("修改密码");
    expect(markup).toContain("reader@example.test");
    expect(markup).toContain("个人介绍");
    expect(markup).toContain("maxLength=\"500\"");
    expect(markup).toContain("更换头像");
  });

  it("shows reader actions without exposing private profile fields in the table", () => {
    const markup = renderToStaticMarkup(createElement(AdminReaderManager, {
      initialReaders: [{
        id: "reader-id",
        email: "reader@example.test",
        displayName: "Reader",
        status: "active",
        passwordResetRequired: false,
        createdAt: new Date("2024-03-02T00:00:00.000Z"),
        phone: "+8613812345678",
        gender: "other",
        delFlag: false,
      }],
      initialSearch: "",
      includeDeleted: false,
    }));

    expect(markup).toContain("创建读者");
    expect(markup).toContain("初始密码为 123456");
    expect(markup).toContain("编辑");
    expect(markup).toContain("重置密码");
    expect(markup).toContain("删除");
    expect(markup).not.toContain("+8613812345678");
    expect(markup).not.toContain("不愿透露");
  });
});
