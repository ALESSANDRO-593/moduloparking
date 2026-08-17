import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ParkingAccessResponse } from '../access-control/models/parking-access.model';
import { ParkingAccessService } from '../access-control/services/parking-access.service';
import { ParkingAuthorization } from '../authorizations/models/parking-authorization.model';
import { ParkingTicketsService } from '../authorizations/services/parking-tickets.service';
import { ParkingUser } from '../users/models/parking-user.model';
import { ParkingUsersService } from '../users/services/parking-users.service';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit {
  private readonly accessService = inject(ParkingAccessService);
  private readonly ticketsService = inject(ParkingTicketsService);
  private readonly usersService = inject(ParkingUsersService);

  protected readonly access = signal<ParkingAccessResponse>({ total: 0, occupied: 0, available: 0, data: [] });
  protected readonly tickets = signal<ParkingAuthorization[]>([]);
  protected readonly users = signal<ParkingUser[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  protected readonly todayEntries = computed(() => {
    const today = this.localIso(new Date());
    return this.access().data.filter(item => item.movement === 'ENTRADA'
      && item.validationStatus === 'AUTORIZADO'
      && this.localIso(new Date(item.occurredAt)) === today).length;
  });

  protected readonly activeTickets = computed(() => {
    const today = this.localIso(new Date());
    return this.tickets().filter(ticket => ticket.status === 'VIGENTE'
      && ticket.startDate <= today
      && ticket.endDate >= today).slice(0, 5);
  });

  ngOnInit(): void { this.load(); }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      access: this.accessService.list(),
      tickets: this.ticketsService.list(),
      users: this.usersService.list()
    }).subscribe({
      next: data => {
        this.access.set(data.access);
        this.tickets.set(data.tickets);
        this.users.set(data.users);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No fue posible cargar el resumen del parqueadero.');
        this.loading.set(false);
      }
    });
  }

  protected userFor(id: number): ParkingUser | undefined { return this.users().find(user => user.id === id); }
  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('es-EC', { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
  }

  private localIso(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
