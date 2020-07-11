import { Component, Inject, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Location } from '@angular/common';
import {
  AppHeaderService, PageId,
  FormAndFrameworkUtilService,
  CommonUtilService, AppGlobalService, TelemetryGeneratorService, InteractType, InteractSubtype, Environment, ImpressionType, ID
} from '../../../services';
import { Router, NavigationExtras } from '@angular/router';
import { RouterLinks, MenuOverflow } from '@app/app/app.constant';
import { Platform, PopoverController } from '@ionic/angular';
import {
  GroupService, GetByIdRequest, Group,
  GroupMember, GroupMemberRole, DeleteByIdRequest,
  RemoveMembersRequest,
  UpdateMembersRequest, RemoveActivitiesRequest, CachedItemRequestSourceFrom, GroupUpdateMembersResponse, GroupRemoveActivitiesResponse
} from '@project-sunbird/sunbird-sdk';
import { OverflowMenuComponent } from '@app/app/profile/overflow-menu/overflow-menu.component';
import GraphemeSplitter from 'grapheme-splitter';
import { SbGenericFormPopoverComponent } from '@app/app/components/popups/sb-generic-form-popover/sb-generic-form-popover.component';
import { SbGenericPopoverComponent } from '@app/app/components/popups';
import { FilterPipe } from '@app/pipes/filter/filter.pipe';

@Component({
  selector: 'app-group-details',
  templateUrl: './group-details.page.html',
  styleUrls: ['./group-details.page.scss'],
})
export class GroupDetailsPage implements OnInit {

  userId: string;
  headerObservable: any;
  groupId: string;
  groupDetails: Group;
  activeTab = 'activities';
  activityList = [];
  filteredActivityList = [];
  memberList: GroupMember[] = [];
  filteredMemberList = [];
  memberSearchQuery: string;
  activitySearchQuery: string;
  private unregisterBackButton: Subscription;
  loggedinUser: GroupMember;
  groupCreator: GroupMember;

  constructor(
    @Inject('GROUP_SERVICE') public groupService: GroupService,
    private appGlobalService: AppGlobalService,
    private headerService: AppHeaderService,
    private router: Router,
    private location: Location,
    private platform: Platform,
    private popoverCtrl: PopoverController,
    private formAndFrameworkUtilService: FormAndFrameworkUtilService,
    private commonUtilService: CommonUtilService,
    private filterPipe: FilterPipe,
    private telemetryGeneratorService: TelemetryGeneratorService
  ) {
    const extras = this.router.getCurrentNavigation().extras.state;
    this.groupId = extras.groupId;
  }

  ngOnInit() {
    this.appGlobalService.getActiveProfileUid()
      .then((uid) => {
        this.userId = uid;
      });
  }

  ionViewWillEnter() {
    this.headerService.showHeaderWithBackButton();
    this.headerObservable = this.headerService.headerEventEmitted$.subscribe(eventName => {
      this.handleHeaderEvents(eventName);
    });
    this.handleDeviceBackButton();
    this.fetchGroupDetails();

    this.telemetryGeneratorService.generateImpressionTelemetry(ImpressionType.VIEW, '', PageId.GROUP_DETAIL, Environment.GROUP);
  }

  ionViewWillLeave() {
    this.headerObservable.unsubscribe();
    if (this.unregisterBackButton) {
      this.unregisterBackButton.unsubscribe();
    }
  }

  handleDeviceBackButton() {
    this.unregisterBackButton = this.platform.backButton.subscribeWithPriority(10, () => {
      this.handleBackButton(false);
    });
  }

  handleHeaderEvents($event) {
    switch ($event.name) {
      case 'back':
        this.handleBackButton(true);
        break;
    }
  }

  handleBackButton(isNavBack) {
    this.telemetryGeneratorService.generateBackClickedTelemetry(PageId.GROUP_DETAIL, Environment.GROUP, isNavBack);
    this.location.back();
  }

  navigateToAddUserPage() {
    this.telemetryGeneratorService.generateInteractTelemetry(InteractType.TOUCH,
      InteractSubtype.ADD_MEMBER_CLICKED, Environment.GROUP, PageId.GROUP_DETAIL);
    const navigationExtras: NavigationExtras = {
      state: {
        groupId: this.groupId,
        memberList: this.memberList
      }
    };
    this.router.navigate([`/${RouterLinks.MY_GROUPS}/${RouterLinks.ADD_MEMBER_TO_GROUP}`], navigationExtras);
  }

  private async fetchGroupDetails() {
    const loader = await this.commonUtilService.getLoader();
    await loader.present();
    const getByIdRequest: GetByIdRequest = {
      from: CachedItemRequestSourceFrom.SERVER,
      id: this.groupId,
      options: {
        includeMembers: true,
        includeActivities: true
      }
    };
    try {
      this.groupDetails = await this.groupService.getById(getByIdRequest).toPromise();
      console.log('this.groupDetails', this.groupDetails);
      this.memberList = this.groupDetails.members;
      this.activityList = this.groupDetails.activities;

      this.loggedinUser = this.memberList.find(m => m.userId === this.userId);
      this.groupCreator = this.memberList.find(m => m.userId === this.groupDetails.createdBy);

      this.filteredMemberList = new Array(...this.memberList);
      this.filteredActivityList = new Array(...this.activityList);

      await loader.dismiss();
    } catch (e) {
      await loader.dismiss();
      console.error(e);
    }
  }

  switchTabs(tab) {
    this.activeTab = tab;
  }

  async groupMenuClick(event) {
    // this.telemetryGeneratorService.generateInteractTelemetry(
    //   InteractType.TOUCH,
    //   InteractSubtype.SORT_OPTION_CLICKED,
    //   Environment.DOWNLOADS,
    // PageId.GROUP_DETAIL);

    let menuList = MenuOverflow.MENU_GROUP_NON_ADMIN;
    if (this.groupCreator.userId === this.userId) {
      menuList = MenuOverflow.MENU_GROUP_CREATOR;
    } else if (this.loggedinUser.role === GroupMemberRole.ADMIN) {
      menuList = MenuOverflow.MENU_GROUP_ADMIN;
    }

    const groupOptions = await this.popoverCtrl.create({
      component: OverflowMenuComponent,
      componentProps: {
        list: menuList
      },
      event,
      cssClass: 'group-option-popover'
    });
    await groupOptions.present();

    const { data } = await groupOptions.onDidDismiss();
    if (data) {
      console.log('dataon dismiss', data);
      if (data.selectedItem === 'MENU_EDIT_GROUP_DETAILS') {
        this.router.navigate(
          [`/${RouterLinks.MY_GROUPS}/${RouterLinks.CREATE_EDIT_GROUP}`],
          {
            state: { groupDetails: this.groupDetails }
          }
        );
      } else if (data.selectedItem === 'MENU_DELETE_GROUP') {
        this.showDeleteGroupPopup();
      }
    }
  }

  async activityMenuClick(event) {
    // this.telemetryGeneratorService.generateInteractTelemetry(
    //   InteractType.TOUCH,
    //   InteractSubtype.SORT_OPTION_CLICKED,
    //   Environment.DOWNLOADS,
    // PageId.GROUP_DETAIL);

    const groupOptions = await this.popoverCtrl.create({
      component: OverflowMenuComponent,
      componentProps: {
        list: MenuOverflow.MENU_GROUP_ACTIVITY_ADMIN
      },
      event: event.event,
      cssClass: 'group-option-popover group-option-popover-admin'
    });
    await groupOptions.present();

    const { data } = await groupOptions.onDidDismiss();
    if (data) {
      console.log('dataon dismiss', data);
      this.showRemoveActivityPopup(data);
    }
  }

  async memberMenuClick(event, selectedMember) {
    // this.telemetryGeneratorService.generateInteractTelemetry(
    //   InteractType.TOUCH,
    //   InteractSubtype.SORT_OPTION_CLICKED,
    //   Environment.DOWNLOADS,
    // PageId.GROUP_DETAIL);
    let menuList = MenuOverflow.MENU_GROUP_MEMBER_NON_ADMIN;

    if (selectedMember.role === GroupMemberRole.ADMIN) {  // Is admin and creator
      menuList = MenuOverflow.MENU_GROUP_MEMBER_ADMIN;
    }

    const groupOptions = await this.popoverCtrl.create({
      component: OverflowMenuComponent,
      componentProps: {
        list: menuList
      },
      event: event.event,
      cssClass: 'group-option-popover'
    });
    await groupOptions.present();

    const { data } = await groupOptions.onDidDismiss();
    if (data) {
      console.log('dataon dismiss', data);
      if (data.selectedItem === 'MENU_MAKE_GROUP_ADMIN') {
        this.showMakeGroupAdminPopup(selectedMember);
      } else if (data.selectedItem === 'MENU_REMOVE_FROM_GROUP') {
        this.showRemoveMemberPopup(selectedMember);
      } else if (data.selectedItem === 'DISMISS_AS_GROUP_ADMIN') {
        this.showDismissAsGroupAdminPopup(selectedMember);
      }
    }
  }

  private async showDeleteGroupPopup() {
    this.telemetryGeneratorService.generateInteractTelemetry(
      InteractType.TOUCH,
      InteractSubtype.DELETE_GROUP_CLICKED,
      Environment.GROUP,
      PageId.GROUP_DETAIL);
    const deleteConfirm = await this.popoverCtrl.create({
      component: SbGenericPopoverComponent,
      componentProps: {
        sbPopoverHeading: this.commonUtilService.translateMessage('DELETE_GROUP_POPUP_TITLE'),
        actionsButtons: [
          {
            btntext: this.commonUtilService.translateMessage('REMOVE'),
            btnClass: 'popover-color'
          },
        ],
        icon: null,
        sbPopoverContent: this.commonUtilService.translateMessage('DELETE_GROUP_DESC', { group_name: this.groupDetails.name })
      },
      cssClass: 'sb-popover danger',
    });
    await deleteConfirm.present();

    const { data } = await deleteConfirm.onDidDismiss();
    if (data) {
      this.telemetryGeneratorService.generateInteractTelemetry(
        InteractType.INITIATED,
        '',
        Environment.GROUP,
        PageId.GROUP_DETAIL,
        undefined,
        undefined,
        undefined,
        undefined,
        ID.DELETE_GROUP);
      const loader = await this.commonUtilService.getLoader();
      await loader.present();
      const deleteByIdRequest: DeleteByIdRequest = {
        id: this.groupId
      };
      try {
        await this.groupService.deleteById(deleteByIdRequest).toPromise();
        await loader.dismiss();
        this.location.back();
        this.telemetryGeneratorService.generateInteractTelemetry(
          InteractType.SUCCESS,
          '',
          Environment.GROUP,
          PageId.GROUP_DETAIL,
          undefined,
          undefined,
          undefined,
          undefined,
          ID.DELETE_GROUP
        );
      } catch (e) {
        await loader.dismiss();
        console.error(e);
      }
    }
  }

  private async showLeaveGroupPopup() {
    this.telemetryGeneratorService.generateInteractTelemetry(
      InteractType.TOUCH,
      InteractSubtype.LEAVE_GROUP_CLICKED,
      Environment.GROUP,
      PageId.GROUP_DETAIL);
    const leaveGroupConfirm = await this.popoverCtrl.create({
      component: SbGenericPopoverComponent,
      componentProps: {
        sbPopoverHeading: this.commonUtilService.translateMessage('LEAVE_GROUP_POPUP_TITLE'),
        actionsButtons: [
          {
            btntext: this.commonUtilService.translateMessage('LEAVE_GROUP'),
            btnClass: 'popover-color'
          },
        ],
        icon: null,
        sbPopoverContent: this.commonUtilService.translateMessage('LEAVE_GROUP_POPUP_DESC', { group_name: this.groupDetails.name })
      },
      cssClass: 'sb-popover danger',
    });
    await leaveGroupConfirm.present();

    const { data } = await leaveGroupConfirm.onDidDismiss();
    if (data) {
      this.telemetryGeneratorService.generateInteractTelemetry(
        InteractType.INITIATED,
        '',
        Environment.GROUP,
        PageId.GROUP_DETAIL,
        undefined,
        undefined,
        undefined,
        undefined,
        ID.LEAVE_GROUP);
      const loader = await this.commonUtilService.getLoader();
      await loader.present();
      const removeMembersRequest: RemoveMembersRequest = {
        groupId: this.groupId,
        removeMembersRequest: {
          userIds: [this.userId]
        }
      };
      try {
        this.groupService.removeMembers(removeMembersRequest).toPromise();
        this.location.back();
        this.telemetryGeneratorService.generateInteractTelemetry(
          InteractType.SUCCESS,
          '',
          Environment.GROUP,
          PageId.GROUP_DETAIL,
          undefined,
          undefined,
          undefined,
          undefined,
          ID.LEAVE_GROUP);
      } catch (e) {
        console.error(e);
      }
      await loader.dismiss();
      this.location.back();
    }
  }

  private async showRemoveActivityPopup(selectedActivity) {
    this.telemetryGeneratorService.generateInteractTelemetry(
      InteractType.TOUCH,
      InteractSubtype.REMOVE_ACTIVITY_CLICKED,
      Environment.GROUP,
      PageId.GROUP_DETAIL);
    const removeActivityConfirm = await this.popoverCtrl.create({
      component: SbGenericPopoverComponent,
      componentProps: {
        sbPopoverHeading: this.commonUtilService.translateMessage('REMOVE_ACTIVITY_POPUP_TITLE'),
        actionsButtons: [
          {
            btntext: this.commonUtilService.translateMessage('REMOVE_ACTIVITY'),
            btnClass: 'popover-color'
          },
        ],
        icon: null,
        sbPopoverContent: this.commonUtilService.translateMessage('REMOVE_ACTIVITY_GROUP_DESC')
      },
      cssClass: 'sb-popover danger',
    });
    await removeActivityConfirm.present();

    const { data } = await removeActivityConfirm.onDidDismiss();
    if (data) {
      this.telemetryGeneratorService.generateInteractTelemetry(
        InteractType.INITIATED,
        '',
        Environment.GROUP,
        PageId.GROUP_DETAIL,
        undefined,
        undefined,
        undefined,
        undefined,
        ID.REMOVE_ACTIVITY);
      const loader = await this.commonUtilService.getLoader();
      await loader.present();
      const removeActivitiesRequest: RemoveActivitiesRequest = {
        groupId: this.groupId,
        removeActivitiesRequest: {
          activityIds: [selectedActivity.id]
        }
      };
      try {
        const removeActivitiesResponse = await this.groupService.removeActivities(removeActivitiesRequest).toPromise();
        await loader.dismiss();
        if (removeActivitiesResponse.error
          && removeActivitiesResponse.error.activities
          && removeActivitiesResponse.error.activities.length) {
          // TODO: Add the error toast.
        } else {
          this.telemetryGeneratorService.generateInteractTelemetry(
            InteractType.SUCCESS,
            '',
            Environment.GROUP,
            PageId.GROUP_DETAIL,
            undefined,
            undefined,
            undefined,
            undefined,
            ID.REMOVE_ACTIVITY);
          this.fetchGroupDetails();
        }
      } catch (e) {
        await loader.dismiss();
        console.error(e);
      }
    }
  }

  private async showRemoveMemberPopup(selectedMember) {
    this.telemetryGeneratorService.generateInteractTelemetry(
      InteractType.TOUCH,
      InteractSubtype.REMOVE_MEMBER_CLICKED,
      Environment.GROUP,
      PageId.GROUP_DETAIL);
    const removeMemberConfirm = await this.popoverCtrl.create({
      component: SbGenericPopoverComponent,
      componentProps: {
        sbPopoverHeading: this.commonUtilService.translateMessage('REMOVE_MEMBER_POPUP_TITLE'),
        actionsButtons: [
          {
            btntext: this.commonUtilService.translateMessage('REMOVE_MEMBER'),
            btnClass: 'popover-color'
          },
        ],
        icon: null,
        sbPopoverContent: this.commonUtilService.translateMessage('REMOVE_MEMBER_GROUP_DESC', { member_name: selectedMember.userName })
      },
      cssClass: 'sb-popover danger',
    });
    await removeMemberConfirm.present();

    const { data } = await removeMemberConfirm.onDidDismiss();
    if (data) {
      this.telemetryGeneratorService.generateInteractTelemetry(
        InteractType.INITIATED,
        '',
        Environment.GROUP,
        PageId.GROUP_DETAIL,
        undefined,
        undefined,
        undefined,
        undefined,
        ID.REMOVE_MEMBER);
      const loader = await this.commonUtilService.getLoader();
      await loader.present();
      const removeMembersRequest: RemoveMembersRequest = {
        groupId: this.groupId,
        removeMembersRequest: {
          userIds: [selectedMember.userId]
        }
      };
      try {
        const removeMemberResponse = await this.groupService.removeMembers(removeMembersRequest).toPromise();

        await loader.dismiss();
        if (removeMemberResponse.error
          && removeMemberResponse.error.members
          && removeMemberResponse.error.members.length) {
          // TODO: Add the error toast.
        } else {
          this.telemetryGeneratorService.generateInteractTelemetry(
            InteractType.SUCCESS,
            '',
            Environment.GROUP,
            PageId.GROUP_DETAIL,
            undefined,
            undefined,
            undefined,
            undefined,
            ID.REMOVE_MEMBER);
          this.fetchGroupDetails();
        }
      } catch (e) {
        await loader.dismiss();
        console.error(e);
      }
    }
  }

  private async showMakeGroupAdminPopup(selectedMember) {
    this.telemetryGeneratorService.generateInteractTelemetry(
      InteractType.TOUCH,
      InteractSubtype.MAKE_GROUP_ADMIN_CLICKED,
      Environment.GROUP,
      PageId.GROUP_DETAIL);
    const makeGroupAdminConfirm = await this.popoverCtrl.create({
      component: SbGenericPopoverComponent,
      componentProps: {
        sbPopoverHeading: this.commonUtilService.translateMessage('MAKE_GROUP_ADMIN_POPUP_TITLE'),
        actionsButtons: [
          {
            btntext: this.commonUtilService.translateMessage('MAKE_ADMIN'),
            btnClass: 'popover-color'
          },
        ],
        icon: null,
        sbPopoverContent: this.commonUtilService.translateMessage('MAKE_GROUP_ADMIN_POPUP_DESC',
          { member_name: selectedMember.userName })
      },
      cssClass: 'sb-popover',
    });
    await makeGroupAdminConfirm.present();

    const { data } = await makeGroupAdminConfirm.onDidDismiss();
    if (data) {
      this.telemetryGeneratorService.generateInteractTelemetry(
        InteractType.INITIATED,
        '',
        Environment.GROUP,
        PageId.GROUP_DETAIL,
        undefined,
        undefined,
        undefined,
        undefined,
        ID.MAKE_GROUP_ADMIN);
      const loader = await this.commonUtilService.getLoader();
      await loader.present();
      const updateMembersRequest: UpdateMembersRequest = {
        groupId: this.groupId,
        updateMembersRequest: {
          members: [{
            userId: selectedMember.userId,
            role: GroupMemberRole.ADMIN
          }]
        }
      };
      try {
        const updateMemberResponse: GroupUpdateMembersResponse = await this.groupService.updateMembers(updateMembersRequest).toPromise();

        await loader.dismiss();
        if (updateMemberResponse.error
          && updateMemberResponse.error.members
          && updateMemberResponse.error.members.length) {
          // TODO: Add the error toast.
        } else {
          this.telemetryGeneratorService.generateInteractTelemetry(
            InteractType.SUCCESS,
            '',
            Environment.GROUP,
            PageId.GROUP_DETAIL,
            undefined,
            undefined,
            undefined,
            undefined,
            ID.MAKE_GROUP_ADMIN);
          this.fetchGroupDetails();
        }
      } catch (e) {
        await loader.dismiss();
        console.error(e);
      }
    }
  }

  private async showDismissAsGroupAdminPopup(selectedMember) {
    this.telemetryGeneratorService.generateInteractTelemetry(
      InteractType.TOUCH,
      InteractSubtype.DISMISS_GROUP_ADMIN_CLICKED,
      Environment.GROUP,
      PageId.GROUP_DETAIL);
    const dismissAsGroupAdminConfirm = await this.popoverCtrl.create({
      component: SbGenericPopoverComponent,
      componentProps: {
        sbPopoverHeading: this.commonUtilService.translateMessage('DISMISS_AS_GROUP_ADMIN_POPUP_TITLE'),
        actionsButtons: [
          {
            btntext: this.commonUtilService.translateMessage('DISMISS_AS_GROUP_ADMIN'),
            btnClass: 'popover-color'
          },
        ],
        icon: null,
        sbPopoverContent: this.commonUtilService.translateMessage('DISMISS_AS_GROUP_ADMIN_POPUP_DESC',
          { member_name: selectedMember.userName })
      },
      cssClass: 'sb-popover',
    });
    await dismissAsGroupAdminConfirm.present();

    const { data } = await dismissAsGroupAdminConfirm.onDidDismiss();
    if (data) {
      this.telemetryGeneratorService.generateInteractTelemetry(
        InteractType.INITIATED,
        '',
        Environment.GROUP,
        PageId.GROUP_DETAIL,
        undefined,
        undefined,
        undefined,
        undefined,
        ID.DISMISS_GROUP_ADMIN);
      const loader = await this.commonUtilService.getLoader();
      await loader.present();
      const updateMembersRequest: UpdateMembersRequest = {
        groupId: this.groupId,
        updateMembersRequest: {
          members: [{
            userId: selectedMember.userId,
            role: GroupMemberRole.MEMBER
          }]
        }
      };
      try {
        const updateMemberResponse: GroupUpdateMembersResponse = await this.groupService.updateMembers(updateMembersRequest).toPromise();
        await loader.dismiss();
        if (updateMemberResponse.error
          && updateMemberResponse.error.members
          && updateMemberResponse.error.members.length) {
          // TODO: Add the error toast.
        } else {
          this.telemetryGeneratorService.generateInteractTelemetry(
            InteractType.SUCCESS,
            '',
            Environment.GROUP,
            PageId.GROUP_DETAIL,
            undefined,
            undefined,
            undefined,
            undefined,
            ID.DISMISS_GROUP_ADMIN);
          this.fetchGroupDetails();
        }
      } catch (e) {
        await loader.dismiss();
        console.error(e);
      }
    }
  }

  onMemberSearch(query) {
    console.log('onMemberSearch', query);
    this.memberSearchQuery = query;
    this.filteredMemberList = [...this.filterPipe.transform(this.memberList, 'title', query)];
  }

  onActivitySearch(query) {
    console.log('onActivitySearch', query);
    this.activitySearchQuery = query;
    this.filteredActivityList = [...this.filterPipe.transform(this.activityList, 'title', query)];
  }

  extractInitial(name) {
    const splitter = new GraphemeSplitter();
    const split: string[] = splitter.splitGraphemes(name.trim());
    return split[0];
  }

  navigateToActivityDetails(event) {
    const navigationExtras: NavigationExtras = {
      state: {
        groupId: this.groupId,
        memberList: this.memberList
      }
    };
    this.router.navigate([`/${RouterLinks.MY_GROUPS}/${RouterLinks.ACTIVITY_DETAILS}`], navigationExtras);
  }

  async showAddActivityPopup() {
    this.telemetryGeneratorService.generateInteractTelemetry(InteractType.TOUCH,
      InteractSubtype.ADD_ACTIVITY_CLICKED, Environment.GROUP, PageId.GROUP_DETAIL);
    try {
      const supportedActivityList = await this.formAndFrameworkUtilService.invokeSupportedGroupActivitiesFormApi();

      const selectActivityPopup = await this.popoverCtrl.create({
        component: SbGenericFormPopoverComponent,
        componentProps: {
          sbPopoverHeading: this.commonUtilService.translateMessage('SELECT_ACTIVITY'),
          actionsButtons: [
            {
              btntext: this.commonUtilService.translateMessage('NEXT'),
              btnClass: 'popover-color'
            }
          ],
          icon: null,
          formItems: supportedActivityList
        },
        cssClass: 'sb-popover info',
      });
      await selectActivityPopup.present();
      const { data } = await selectActivityPopup.onDidDismiss();
      if (data && data.selectedVal && data.selectedVal.activityType === 'Content') {
        this.search(data);
      }
    } catch (e) {
      console.log(e);
    }
  }

  private async search(data) {
    // this.telemetryGeneratorService.generateInteractTelemetry(InteractType.TOUCH,
    //   InteractSubtype.SEARCH_BUTTON_CLICKED,
    //   Environment.HOME,
    //   PageId.COURSES);
    this.router.navigate([RouterLinks.SEARCH], {
      state: {
        activityFilters: data.selectedVal.filters,
        source: PageId.GROUP_DETAIL,
        groupId: this.groupId
      }
    });
  }

}
