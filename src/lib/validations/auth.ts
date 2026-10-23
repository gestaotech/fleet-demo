import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail invalido"),
  password: z.string().min(1, "Informe a senha"),
  companyId: z.string().min(1).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
