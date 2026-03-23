import { Injectable } from '@angular/core';
import { ClasschatDataService } from './data-service/classchat.ds';
import { ClassDataService } from './data-service/class.ds';
import { MessageDataService } from './data-service/message.ds';
import { SessionDataService } from './data-service/session.ds';
import { UserDataService } from './data-service/user.ds';
import { RequestDataService } from './data-service/request.ds';

@Injectable({
  providedIn: 'root'
})
export class DataService {

  constructor(
    public classchatDS: ClasschatDataService,
    public classDS: ClassDataService,
    public messageDS: MessageDataService,
    public requestDS: RequestDataService,
    public sessionDS: SessionDataService,
    public userDS: UserDataService
  ) {}
}