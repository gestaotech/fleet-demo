import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    fase: "1-fundacao",
    descricao: "API base - autenticacao e autorizacao no servidor",
  });
}
