"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { db } from "@/lib/mocks";
import { Search } from "lucide-react";
import Link from "next/link";

export default function ManutencaoPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todas");
  const statuses = ["Todas", "Aberta", "Em andamento", "Aguardando peças", "Finalizada"];

  const filtered = db.workOrders.filter(wo => {
    const vehicle = db.vehicles.find(v => v.id === wo.vehicleId);
    const mechanic = db.mechanics.find(m => m.id === wo.mechanicId);
    const matchesSearch = wo.id.toLowerCase().includes(search.toLowerCase()) ||
      (vehicle && vehicle.name.toLowerCase().includes(search.toLowerCase())) ||
      (mechanic && mechanic.name.toLowerCase().includes(search.toLowerCase())) ||
      wo.problem.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "Todas" || wo.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusBadge = (s: string) => {
    switch (s) {
      case "Finalizada": return <Badge variant="success">{s}</Badge>;
      case "Em andamento": return <Badge variant="default">{s}</Badge>;
      case "Aguardando peças": return <Badge variant="warning">{s}</Badge>;
      default: return <Badge variant="secondary">{s}</Badge>;
    }
  };

  return (
    <DashboardLayout title="Manutenção" breadcrumbs={[{ label: "Manutenção" }]}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar OS, veículo, mecânico, problema..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>OS</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Problema</TableHead>
                  <TableHead>Mecânico</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(wo => {
                  const vehicle = db.vehicles.find(v => v.id === wo.vehicleId);
                  const mechanic = db.mechanics.find(m => m.id === wo.mechanicId);
                  return (
                    <TableRow key={wo.id}>
                      <TableCell><Link href={`/manutencao/${wo.id}`} className="font-medium text-primary hover:underline">{wo.id}</Link></TableCell>
                      <TableCell>{vehicle?.name} ({vehicle?.plate})</TableCell>
                      <TableCell className="max-w-xs truncate">{wo.problem}</TableCell>
                      <TableCell>{mechanic?.name}</TableCell>
                      <TableCell>{statusBadge(wo.status)}</TableCell>
                      <TableCell>{new Date(wo.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}