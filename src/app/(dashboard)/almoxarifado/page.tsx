"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { db, addStockEntry, adjustStock, getLastMovementForPart } from "@/lib/mocks";
import { Package, AlertTriangle, TrendingUp, DollarSign, Plus, RotateCcw } from "lucide-react";
import { useRoleGuard } from "@/hooks/useRoleGuard";
import { toast } from "sonner";

export default function AlmoxarifadoPage() {
  useRoleGuard(["GESTOR", "ALMOXARIFADO"]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [statusFilter, setStatusFilter] = useState("Todas");
  const categories = ["Todas", ...new Set(db.parts.map(p => p.category))];
  const statuses = ["Todas", "Normal", "Estoque baixo", "Sem estoque"];

  // Indicators
  const totalItemsTypes = db.parts.length;
  const totalItemsQty = db.parts.reduce((s,p)=>s+p.stock,0);
  const totalValue = db.parts.reduce((s,p)=>s+p.stock*p.unitPrice,0);
  const lowStockCount = db.parts.filter(p=>p.stock>0 && p.stock<=p.minStock).length;
  const outOfStockCount = db.parts.filter(p=>p.stock<=0).length;
  const pendingReqs = db.partRequests.filter(r=>r.status==="Pendente").length;

  const filtered = db.parts.filter(p=>{
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter==="Todas" || p.category===categoryFilter;
    let matchesStatus = true;
    if (statusFilter==="Normal") matchesStatus = p.stock>p.minStock;
    else if (statusFilter==="Estoque baixo") matchesStatus = p.stock>0 && p.stock<=p.minStock;
    else if (statusFilter==="Sem estoque") matchesStatus = p.stock<=0;
    return matchesSearch && matchesCat && matchesStatus;
  });

  const statusBadge = (p: typeof db.parts[0]) => {
    if (p.stock <= 0) return <Badge variant="destructive">Sem estoque</Badge>;
    if (p.stock <= p.minStock) return <Badge variant="warning">Estoque baixo</Badge>;
    return <Badge variant="success">Normal</Badge>;
  };

  // Modals
  const [entryOpen, setEntryOpen] = useState(false);
  const [adjOpen, setAdjOpen] = useState(false);
  const [entryPart, setEntryPart] = useState("");
  const [entryQty, setEntryQty] = useState(1);
  const [entryObs, setEntryObs] = useState("");
  const [entryError, setEntryError] = useState("");
  const [adjPart, setAdjPart] = useState("");
  const [adjQty, setAdjQty] = useState(0);
  const [adjReason, setAdjReason] = useState("");
  const [adjError, setAdjError] = useState("");

  const closeEntry = () => {
    setEntryOpen(false);
    setEntryPart(""); setEntryQty(1); setEntryObs(""); setEntryError("");
  };
  const closeAdjust = () => {
    setAdjOpen(false);
    setAdjPart(""); setAdjQty(0); setAdjReason(""); setAdjError("");
  };

  const handleEntry = () => {
    const result = addStockEntry(entryPart, entryQty, entryObs);
    if (result.success) {
      toast.success(result.message);
      closeEntry();
    } else {
      setEntryError(result.message);
      toast.error(result.message);
    }
  };
  const handleAdjust = () => {
    const result = adjustStock(adjPart, adjQty, adjReason);
    if (result.success) {
      toast.success(result.message);
      closeAdjust();
    } else {
      setAdjError(result.message);
      toast.error(result.message);
    }
  };

  return (
    <DashboardLayout title="Almoxarifado" breadcrumbs={[{ label: "Almoxarifado" }]}>
      <div className="space-y-6">
        {/* Indicators */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de tipos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{totalItemsTypes}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de itens</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{totalItemsQty}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor estimado</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">R$ {totalValue.toLocaleString("pt-BR",{minimumFractionDigits:2})}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estoque baixo</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{lowStockCount}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sem estoque</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{outOfStockCount}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Solicitações pendentes</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{pendingReqs}</div></CardContent>
          </Card>
        </div>

        {/* Stock table with filters and actions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle>Estoque</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={()=>setEntryOpen(true)}><Plus className="mr-2 h-4 w-4" /> Entrada</Button>
              <Button variant="outline" onClick={()=>setAdjOpen(true)}><RotateCcw className="mr-2 h-4 w-4" /> Ajuste</Button>
              <div className="flex gap-2">
                <Input placeholder="Buscar peça ou código..." value={search} onChange={e=>setSearch(e.target.value)} className="w-[250px]" />
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>{categories.map(c=> <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>{statuses.map(s=> <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Peça</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última movimentação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p=>{
                  const lastMov = getLastMovementForPart(p.id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{p.code}</TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.category}</TableCell>
                      <TableCell>{p.unit}</TableCell>
                      <TableCell className="text-right">{p.stock}</TableCell>
                      <TableCell className="text-right">{p.minStock}</TableCell>
                      <TableCell>{statusBadge(p)}</TableCell>
                      <TableCell>{lastMov ? new Date(lastMov.date).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Entrada Modal */}
        <Dialog open={entryOpen} onOpenChange={(open)=>{ if(!open) closeEntry(); }}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle>Entrada de estoque</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <Select value={entryPart} onValueChange={(v)=>{setEntryPart(v); setEntryError("");}}>
                <SelectTrigger><SelectValue placeholder="Peça" /></SelectTrigger>
                <SelectContent>
                  {db.parts.map(p => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name} (Estoque: {p.stock})</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Quantidade</label>
                  <Input type="number" min="1" value={entryQty} onChange={e=>{setEntryQty(parseInt(e.target.value)||0); setEntryError("");}} />
                </div>
                <div>
                  <label className="text-sm font-medium">Observação</label>
                  <Input value={entryObs} onChange={e=>setEntryObs(e.target.value)} placeholder="Opcional" />
                </div>
              </div>
              {entryError && <p className="text-sm text-danger">{entryError}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeEntry}>Cancelar</Button>
              <Button onClick={handleEntry} disabled={!entryPart || entryQty<=0}>Confirmar entrada</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Ajuste Modal */}
        <Dialog open={adjOpen} onOpenChange={(open)=>{ if(!open) closeAdjust(); }}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle>Ajustar estoque</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <Select value={adjPart} onValueChange={(v)=>{setAdjPart(v); setAdjError("");}}>
                <SelectTrigger><SelectValue placeholder="Peça" /></SelectTrigger>
                <SelectContent>
                  {db.parts.map(p => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name} (Estoque: {p.stock})</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Nova quantidade</label>
                  <Input type="number" min="0" value={adjQty} onChange={e=>{setAdjQty(parseInt(e.target.value)||0); setAdjError("");}} />
                </div>
                <div>
                  <label className="text-sm font-medium">Motivo</label>
                  <Input value={adjReason} onChange={e=>{setAdjReason(e.target.value); setAdjError("");}} placeholder="Motivo do ajuste" />
                </div>
              </div>
              {adjError && <p className="text-sm text-danger">{adjError}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeAdjust}>Cancelar</Button>
              <Button onClick={handleAdjust} disabled={!adjPart || adjQty<0 || !adjReason.trim()}>Confirmar ajuste</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}