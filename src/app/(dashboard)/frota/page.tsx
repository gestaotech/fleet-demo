"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { db } from "@/lib/mocks";
import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRoleGuard } from "@/hooks/useRoleGuard";

export default function FrotaPage() {
  useRoleGuard(["GESTOR", "MANUTENCAO"]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [newVehicle, setNewVehicle] = useState({ name: "", plate: "", model: "", year: "", km: "" });

  const statuses = ["Todos", "Disponível", "Em manutenção", "Indisponível"];

  const filtered = db.vehicles.filter(v => {
    const matchesSearch = v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.plate.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "Todos" || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusBadge = (s: string) => {
    switch (s) {
      case "Disponível": return <Badge variant="success">{s}</Badge>;
      case "Em manutenção": return <Badge variant="warning">{s}</Badge>;
      default: return <Badge variant="destructive">{s}</Badge>;
    }
  };

  const handleAddVehicle = () => {
    const id = `v${Date.now()}`;
    db.vehicles.push({
      id,
      name: newVehicle.name,
      plate: newVehicle.plate,
      model: newVehicle.model,
      year: parseInt(newVehicle.year) || new Date().getFullYear(),
      km: parseInt(newVehicle.km) || 0,
      status: "Disponível",
      lastMaintenance: new Date().toISOString().split("T")[0],
      nextMaintenance: new Date(Date.now() + 90*24*60*60*1000).toISOString().split("T")[0],
    });
    setNewVehicle({ name: "", plate: "", model: "", year: "", km: "" });
  };

  return (
    <DashboardLayout title="Frota" breadcrumbs={[{ label: "Frota" }]}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle>Veículos</CardTitle>
          <Dialog>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Novo veículo</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Novo veículo</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-sm font-medium">Nome</label>
                    <Input value={newVehicle.name} onChange={e => setNewVehicle({...newVehicle, name: e.target.value})} placeholder="Mercedes-Benz Atego" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Placa</label>
                    <Input value={newVehicle.plate} onChange={e => setNewVehicle({...newVehicle, plate: e.target.value})} placeholder="ABC-1234" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Modelo</label>
                    <Input value={newVehicle.model} onChange={e => setNewVehicle({...newVehicle, model: e.target.value})} placeholder="Atego 2429" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Ano</label>
                    <Input value={newVehicle.year} onChange={e => setNewVehicle({...newVehicle, year: e.target.value})} type="number" placeholder="2022" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium">KM inicial</label>
                    <Input value={newVehicle.km} onChange={e => setNewVehicle({...newVehicle, km: e.target.value})} type="number" placeholder="0" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewVehicle({ name: "", plate: "", model: "", year: "", km: "" })}>Cancelar</Button>
                <Button onClick={handleAddVehicle}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar veículo, placa, modelo..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Ano</TableHead>
                  <TableHead>KM</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última manutenção</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(v => (
                  <TableRow key={v.id}>
                    <TableCell><Link href={`/frota/${v.id}`} className="font-medium text-primary hover:underline">{v.name}</Link></TableCell>
                    <TableCell>{v.plate}</TableCell>
                    <TableCell>{v.model}</TableCell>
                    <TableCell>{v.year}</TableCell>
                    <TableCell>{v.km.toLocaleString("pt-BR")} km</TableCell>
                    <TableCell>{statusBadge(v.status)}</TableCell>
                    <TableCell>{new Date(v.lastMaintenance).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/frota/${v.id}`} className="text-sm text-primary hover:underline">Ver</Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}