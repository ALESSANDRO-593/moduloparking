import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { ParkingUser } from '../users/models/parking-user.model';
import { ParkingUsersService } from '../users/services/parking-users.service';
import { ParkingVehicle } from '../vehicles/models/parking-vehicle.model';
import { ParkingVehiclesService } from '../vehicles/services/parking-vehicles.service';
import {
  ParkingModality,
  ParkingModalityOption,
  ParkingPayment,
  ParkingPaymentMethod,
  ParkingPaymentStatus
} from './models/parking-payment.model';
import { ParkingPaymentsService } from './services/parking-payments.service';

type ModalityFilter = 'TODAS' | ParkingModality;
type PaymentStatusFilter = 'TODOS' | ParkingPaymentStatus;

@Component({
  selector: 'app-payments',
  imports: [ReactiveFormsModule],
  templateUrl: './payments.html',
  styleUrl: './payments.scss'
})
export class Payments implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly usersService = inject(ParkingUsersService);
  private readonly vehiclesService = inject(ParkingVehiclesService);
  private readonly paymentsService = inject(ParkingPaymentsService);

  protected readonly parkingUsers = signal<ParkingUser[]>([]);
  protected readonly vehicles = signal<ParkingVehicle[]>([]);
  protected readonly modalities = signal<ParkingModalityOption[]>([]);
  protected readonly payments = signal<ParkingPayment[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly modalityFilter = signal<ModalityFilter>('TODAS');
  protected readonly statusFilter = signal<PaymentStatusFilter>('TODOS');
  protected readonly selectedUserId = signal<number | null>(null);
  protected readonly isModalOpen = signal(false);
  protected readonly feedback = signal('');
  protected readonly loadError = signal('');
  protected readonly mutationError = signal('');
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);

  protected readonly paymentForm = this.formBuilder.nonNullable.group({
    parkingUserId: ['', Validators.required],
    modality: ['DIARIO' as ParkingModality, Validators.required],
    startDate: [this.todayIso(), Validators.required],
    method: ['EFECTIVO' as ParkingPaymentMethod, Validators.required],
    reference: ['', Validators.maxLength(120)],
    status: ['APROBADO' as Extract<ParkingPaymentStatus, 'PENDIENTE' | 'APROBADO'>, Validators.required],
    issueAuthorization: [true, Validators.required],
    vehicleId: ['', Validators.required]
  });

  protected readonly availableUsers = computed(() => this.parkingUsers().filter(user => user.enabled));
  protected readonly filteredPayments = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase('es');
    const modality = this.modalityFilter();
    const status = this.statusFilter();
    return this.payments().filter(payment => {
      const user = this.userFor(payment.parkingUserId);
      const matchesQuery = !query || [
        user?.fullName ?? '', user?.identification ?? '', payment.reference ?? ''
      ].some(value => value.toLocaleLowerCase('es').includes(query));
      return matchesQuery
        && (modality === 'TODAS' || payment.modality === modality)
        && (status === 'TODOS' || payment.status === status);
    });
  });
  protected readonly hasActiveFilters = computed(() =>
    this.searchTerm().trim() !== '' || this.modalityFilter() !== 'TODAS' || this.statusFilter() !== 'TODOS'
  );

  ngOnInit(): void {
    this.loadData();
  }

  protected loadData(): void {
    this.isLoading.set(true);
    this.loadError.set('');
    forkJoin({
      users: this.usersService.list(),
      vehicles: this.vehiclesService.list(),
      modalities: this.paymentsService.catalogs(),
      payments: this.paymentsService.list()
    }).subscribe({
      next: data => {
        this.parkingUsers.set(data.users);
        this.vehicles.set(data.vehicles);
        this.modalities.set(data.modalities);
        this.payments.set(data.payments);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('No fue posible consultar los pagos.');
        this.isLoading.set(false);
      }
    });
  }

  protected updateSearch(event: Event): void { this.searchTerm.set((event.target as HTMLInputElement).value); }
  protected updateModalityFilter(event: Event): void { this.modalityFilter.set((event.target as HTMLSelectElement).value as ModalityFilter); }
  protected updateStatusFilter(event: Event): void { this.statusFilter.set((event.target as HTMLSelectElement).value as PaymentStatusFilter); }
  protected userFor(userId: number): ParkingUser | undefined { return this.parkingUsers().find(user => user.id === userId); }

  protected availableVehicles(): ParkingVehicle[] {
    const userId = this.selectedUserId();
    return userId === null ? [] : this.vehicles().filter(vehicle => vehicle.active && vehicle.parkingUserId === userId);
  }

  protected openRegistration(): void {
    this.paymentForm.reset({
      parkingUserId: '', modality: 'DIARIO', startDate: this.todayIso(), method: 'EFECTIVO',
      reference: '', status: 'APROBADO', issueAuthorization: true, vehicleId: ''
    });
    this.selectedUserId.set(null);
    this.mutationError.set('');
    this.handleMethodChange();
    this.isModalOpen.set(true);
  }

  protected closeRegistration(): void { if (!this.isSaving()) this.isModalOpen.set(false); }

  @HostListener('document:keydown.escape')
  protected closeOnEscape(): void { if (this.isModalOpen()) this.closeRegistration(); }

  protected handleUserChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const userId = value ? Number(value) : null;
    this.selectedUserId.set(userId);
    const primary = userId === null ? undefined : this.vehicles().find(vehicle =>
      vehicle.active && vehicle.isPrimary && vehicle.parkingUserId === userId
    );
    this.paymentForm.controls.vehicleId.setValue(primary ? String(primary.id) : '');
    this.mutationError.set('');
  }

  protected handleMethodChange(): void {
    const transfer = this.paymentForm.controls.method.value === 'TRANSFERENCIA';
    const reference = this.paymentForm.controls.reference;
    if (transfer) {
      reference.addValidators(Validators.required);
      this.paymentForm.controls.status.setValue('PENDIENTE');
      this.paymentForm.controls.issueAuthorization.setValue(false);
    } else {
      reference.removeValidators(Validators.required);
      reference.setValue('');
      this.paymentForm.controls.status.setValue('APROBADO');
      this.paymentForm.controls.issueAuthorization.setValue(true);
    }
    reference.updateValueAndValidity();
  }

  protected handleStatusChange(): void {
    this.paymentForm.controls.issueAuthorization.setValue(this.paymentForm.controls.status.value === 'APROBADO');
  }

  protected amountFor(): number {
    const vehicle = this.vehicles().find(item => item.id === Number(this.paymentForm.controls.vehicleId.value));
    if (!vehicle) return 0;
    return this.modalities().find(option =>
      option.modality === this.paymentForm.controls.modality.value && option.vehicleType === vehicle.type
    )?.amount ?? 0;
  }

  protected calculatedEndDate(): string {
    const startDate = this.paymentForm.controls.startDate.value;
    if (!startDate) return '';
    const date = new Date(`${startDate}T00:00:00Z`);
    if (this.paymentForm.controls.modality.value === 'MENSUAL') date.setUTCDate(date.getUTCDate() + 29);
    return date.toISOString().slice(0, 10);
  }

  protected registerPayment(): void {
    if (this.paymentForm.invalid || this.amountFor() <= 0) {
      this.paymentForm.markAllAsTouched();
      if (this.amountFor() <= 0) this.mutationError.set('No existe una tarifa activa para la modalidad y el vehículo seleccionados.');
      return;
    }
    const values = this.paymentForm.getRawValue();
    this.isSaving.set(true);
    this.mutationError.set('');
    this.paymentsService.create({
      parkingUserId: Number(values.parkingUserId),
      vehicleId: Number(values.vehicleId),
      modality: values.modality as ParkingModality,
      startDate: values.startDate,
      method: values.method as ParkingPaymentMethod,
      reference: values.method === 'TRANSFERENCIA' ? values.reference.trim() : null,
      status: values.status,
      issueAuthorization: values.status === 'APROBADO' && values.issueAuthorization
    }).subscribe({
      next: response => {
        this.isSaving.set(false);
        this.feedback.set(response.authorizationId
          ? 'Pago registrado y ticket generado correctamente.'
          : values.status === 'PENDIENTE'
            ? 'Transferencia registrada y pendiente de verificación.'
            : 'Pago registrado correctamente.');
        this.isModalOpen.set(false);
        this.loadData();
      },
      error: error => {
        this.mutationError.set(error.error?.error ?? 'No fue posible registrar el pago.');
        this.isSaving.set(false);
      }
    });
  }

  protected isCurrent(payment: ParkingPayment): boolean {
    const today = this.todayIso();
    return payment.status === 'APROBADO' && payment.startDate <= today && payment.endDate >= today;
  }

  protected formatDate(date: string): string {
    if (!date) return '—';
    return new Intl.DateTimeFormat('es-EC', { timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
  }

  private todayIso(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  }
}
