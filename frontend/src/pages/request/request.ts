import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, ActivatedRouteSnapshot, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DataService } from '../../services/data-service/data.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-request',
  imports: [CommonModule, RouterModule],
  templateUrl: './request.html',
  styleUrl: './request.css',
})
export class Request implements OnInit{

  response: any | null = null;  
  
  constructor(
      private route: ActivatedRoute,
      private dataService: DataService,
      private router: Router,
      private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.response = data['request'];
    });
  }
  public accept(): void {
    const token = this.authService.tokenValue;
    const link = this.response.request;
    if (!token || !link) return;
    this.dataService.requestDS.accept(token,link).subscribe((response: any) => {
    if (response && response.link) {
      this.router.navigate(['/class',response.link]);
    }
    });
  }
  public decline(): void {
    const token = this.authService.tokenValue;
    const link = this.response.request;
    if (!token || !link) return;
    this.dataService.requestDS.decline(token,link).subscribe((response: any) => {
    if (response) {
      this.router.navigate(['/class']);
    }
    });
  }

}
