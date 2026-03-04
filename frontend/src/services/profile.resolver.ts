import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';
import { DataService } from './data.service';
import { User } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class ProfileResolver implements Resolve<User> {
  constructor(private dataService: DataService) {}

  resolve(route: ActivatedRouteSnapshot) {
    const username = route.paramMap.get('username');
    return this.dataService.getProfile(username!);
  }
}