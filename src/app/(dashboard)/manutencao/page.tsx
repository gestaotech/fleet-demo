"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { db, createWorkOrder } from "@/lib/mocks";
import { Search, Plus, Truck, ClipboardList, AlertTriangle, PackageCheck } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { toast } from "sonner";

export default function ManutencaoPage() {
  useRoleGuard(["GESTOR", "MANUTENCAO"]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todas");
  const statuses = ["Todas", "Aberta", "Em andamento", "Aguardando peças", "Finalizada"];

  // Indicators
  const vehiclesInMaintenance = db.vehicles.filter(v => v.status === "Em manutenção").length;
  const openOrders = db.workOrders.filter(wo => wo.status === "Aberta").length;
  const inProgressOrders = db.workOrders.filter(wo => wo.status === "Em andamento").length;
  const awaitingPartsOrders = db.workOrders.filter(wo => wo.status === "Aguardando peças").length;
  const pendingRequests = db.partRequests.filter(r => r.status === "Pendente").length;

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

  // Create OS modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newOS, setNewOS] = useState({ vehicleId: "", problem: "", observations: "", mechanicId: "" });
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newOS.vehicleId || !newOS.problem || !newOS.mechanicId) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setCreating(true);
    createWorkOrder({
      vehicleId: newOS.vehicleId,
      mechanicId: newOS.mechanicId,
      problem: newOS.problem,
      observations: newOS.observations,
    });
    toast.success("Ordem de Serviço criada com sucesso");
    setNewOS({ vehicleId: "", problem: "", observations: "", mechanicId: "" });
    setIsCreateOpen(false);
    setCreating(false);
  };

  const statCards = [
    { title: "Veículos em manutenção", value: vehiclesInMaintenance, icon: Truck, color: "text-warning", bg: "bg-warning/10" },
    { title: "OS abertas", value: openOrders, icon: ClipboardList, color: "text-brand-primary", bg: "bg-brand-primary-light" },
    { title: "OS em andamento", value: inProgressOrders, icon: ClipboardList, color: "text-brand-primary", bg: "bg-brand-primary-light" },
    { title: "OS aguardando peças", value: awaitingPartsOrders, icon: PackageCheck, color: "text-warning", bg: "bg-warning/10" },
    { title: "Solicitações pendentes", value: pendingRequests, icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10" },
  ];

  return (
    <DashboardLayout title="Manutenção" breadcrumbs={[{ label: "Manutenção" }]}>
      <div className="space-y-8">
        {/* Indicators */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {statCards.map((c, idx) => {
            const Icon = c.icon;
            return (
              <Card key={idx} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-secondary">{c.title}</p>
                      <p className="text-3xl font-bold text-text-primary mt-1">{c.value}</p>
                    </div>
                    <div className={cn("p-3 rounded-lg shrink-0", c.bg)}>
                      <Icon className={cn("h-5 w-5", c.color)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* OS List with filters and create button */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Ordens de Serviço</CardTitle>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Nova OS</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Nova Ordem de Serviço</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <Select value={newOS.vehicleId} onValueChange={v => setNewOS({...newOS, vehicleId: v})}>
                    <SelectTrigger><SelectValue placeholder="Veículo" /></SelectTrigger>
                    <SelectContent>
                      {db.vehicles.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.name} - {v.plate}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={newOS.mechanicId} onValueChange={v => setNewOS({...newOS, mechanicId: v})}>
                    <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
                    <SelectContent>
                      {db.mechanics.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div>
                    <label className="text-sm font-medium">Problema</label>
                    <Input value={newOS.problem} onChange={e => setNewOS({...newOS, problem: e.target.value})} placeholder="Descreva o problema" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Observações (opcional)</label>
                    <Input value={newOS.observations} onChange={e => setNewOS({...newOS, observations: e.target.value})} placeholder="Observações" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={creating}>Cancelar</Button>
                  <Button onClick={handleCreate} disabled={creating}>{creating ? "Criando..." : "Criar OS"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar OS, veículo, mecânico, problema..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>OS</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Problema</TableHead>
                  <TableHead>Responsável</TableHead>
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