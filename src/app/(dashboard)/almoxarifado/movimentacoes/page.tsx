"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { db } from "@/lib/mocks";
import { useRoleGuard } from "@/hooks/useRoleGuard";
// import icons if needed

export default function MovimentacoesPage() {
  useRoleGuard(["GESTOR", "ALMOXARIFADO"]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("Todos");
  const types = ["Todos", "Entrada", "Saída", "Ajuste"];

  const movements = [...db.stockMovements]
    .filter(m => {
      const part = db.parts.find(p => p.id === m.partId);
      const matchesSearch = part?.name.toLowerCase().includes(search.toLowerCase()) || part?.code.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "Todos" || m.type === typeFilter;
      return matchesSearch && matchesType;
    })
    .sort((a,b)=> new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calculate running balance per part
  const balanceByPart: Record<string, number> = {};
  const movementsWithBalance = movements.map(m => {
    const current = balanceByPart[m.partId] ?? 0;
    const newBalance = current + m.quantity;
    balanceByPart[m.partId] = newBalance;
    return { ...m, balance: newBalance };
  }).reverse(); // show oldest first for balance calculation

  const typeBadge = (t: string) => {
    switch (t) {
      case "Entrada": return <Badge variant="success">{t}</Badge>;
      case "Saída": return <Badge variant="destructive">{t}</Badge>;
      case "Ajuste": return <Badge variant="secondary">{t}</Badge>;
      default: return <Badge variant="outline">{t}</Badge>;
    }
  };

  return (
    <DashboardLayout title="Movimentações" breadcrumbs={[{ label: "Almoxarifado", href: "/almoxarifado" }, { label: "Movimentações" }]}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Histórico de movimentações</CardTitle>
          <div className="flex gap-2">
            <Input placeholder="Buscar peça ou código..." value={search} onChange={e=>setSearch(e.target.value)} className="w-[250px]" />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>{types.map(t=> <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Responsável</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movementsWithBalance.map(m => {
                const part = db.parts.find(p => p.id === m.partId);
                return (
                  <TableRow key={m.id}>
                    <TableCell>{new Date(m.date).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>{typeBadge(m.type)}</TableCell>
                    <TableCell>{part?.name} ({part?.code})</TableCell>
                    <TableCell className="text-right font-mono">{m.quantity>0?"+":""}{m.quantity}</TableCell>
                    <TableCell className="text-right font-mono">{m.balance}</TableCell>
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