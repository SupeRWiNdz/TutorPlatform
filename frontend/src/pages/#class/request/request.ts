import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '@services/auth.service';
import { DataService } from '@services/data.service';
import { RoleIconPipe } from "@pipes/role-icon.pipe";
import { MatIcon } from "@angular/material/icon";
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-request',
  imports: [CommonModule, RouterModule,
    MatButtonModule, MatProgressSpinnerModule, RoleIconPipe, MatIcon],
  templateUrl: './request.html',
  styleUrl: './request.scss',
})
export class Request implements OnInit {

  response: any | null = null;

  private _snackBar = inject(MatSnackBar);
  openSnackBar(message: string) {
    this._snackBar.open(message, 'Закрыть', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }

  constructor(
    private route: ActivatedRoute,
    private dataService: DataService,
    private router: Router,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.response = data['request'];
      if (this.response?.message) {
        this.openSnackBar(this.response.message);
        this.router.navigate(['/']);
      }
    });
  }
  public accept(): void {
    const token = this.authService.tokenValue;
    const link = this.response.request;
    if (!token || !link) return;
    this.dataService.requestDS.accept(token, link).subscribe((response: any) => {
      if (response && response.link) {
        this.router.navigate(['/class', response.link]);
      }
    });
  }
  public decline(): void {
    const token = this.authService.tokenValue;
    const link = this.response.request;
    if (!token || !link) return;
    this.dataService.requestDS.decline(token, link).subscribe((response: any) => {
      if (response) {
        this.router.navigate(['/class']);
      }
    });
  }

}
