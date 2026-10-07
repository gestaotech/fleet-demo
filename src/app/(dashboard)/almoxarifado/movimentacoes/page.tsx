"use client";

export const dynamic = "force-dynamic";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { db } from "@/lib/mocks";

export default function MovimentacoesPage() {
  const movements = [...db.stockMovements].sort((a,b)=> new Date(b.date).getTime() - new Date(a.date).getTime());

  const typeBadge = (t: string) => t==="Entrada" ? <Badge variant="success">{t}</Badge> : <Badge variant="destructive">{t}</Badge>;

  return (
    <DashboardLayout title="Movimentações" breadcrumbs={[{ label: "Almoxarifado", href: "/almoxarifado" }, { label: "Movimentações" }]}>
      <Card>
        <CardHeader><CardTitle>Histórico de movimentações</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Responsável</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map(m => {
                const part = db.parts.find(p => p.id === m.partId);
                return (
                  <TableRow key={m.id}>
                    <TableCell>{new Date(m.date).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>{typeBadge(m.type)}</TableCell>
                    <TableCell>{part?.name} ({part?.code})</TableCell>
                    <TableCell className="text-right font-mono">{m.quantity>0?"+":""}{m.quantity}</TableCell>
                    <TableCell>{m.origin}</TableCell>
                    <TableCell>{m.responsible}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}