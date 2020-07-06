import { Component, OnInit, Inject, OnDestroy, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { TelemetryGeneratorService } from '@app/services/telemetry-generator.service';
import { ContentType, AudienceFilter, ProfileConstants, FormConfigSubcategories } from '../app.constant';
import {
  ProfileService,
  ContentService,
  DeviceInfo,
  Profile,
  GetAllProfileRequest,
  ContentRequest,
  SharedPreferences,
  FrameworkUtilService,
  GetSuggestedFrameworksRequest,
  CachedItemRequestSourceFrom,
  FrameworkCategoryCodesGroup,
  Framework,
  FrameworkService,
  GetFrameworkCategoryTermsRequest,
  FrameworkCategoryCode,
  TelemetryService,
  TelemetrySyncStat,
  CorrelationData
} from 'sunbird-sdk';
import { Environment, InteractType, PageId, ImpressionType, InteractSubtype, CorReleationDataType, ID } from '@app/services/telemetry-constants';
import { AppGlobalService } from '@app/services/app-global-service.service';
import { CommonUtilService } from '@app/services/common-util.service';
import { SocialSharing } from '@ionic-native/social-sharing/ngx';
import { AppVersion } from '@ionic-native/app-version/ngx';
import { map, tap, switchMap, distinctUntilChanged, catchError } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { FormControl } from '@angular/forms';
import { defer, of, EMPTY } from 'rxjs';
import { AppHeaderService, FormAndFrameworkUtilService } from '@app/services';
import { Location } from '@angular/common';
import { FieldConfigOptionsBuilder, FieldConfigOption } from 'common-form-elements';
import { ExploreBooksSortComponent } from '../resources/explore-books-sort/explore-books-sort.component';
import { ModalController } from '@ionic/angular';

const KEY_SUNBIRD_CONFIG_FILE_PATH = 'sunbird_config_file_path';
const SUBJECT_NAME = 'support request';

@Component({
  selector: 'app-fa-report-issue',
  templateUrl: './faq-report-issue.page.html',
  styleUrls: ['./faq-report-issue.page.scss']
})
export class FaqReportIssuePage implements OnInit, OnDestroy {



  data: any;
  private messageListener: (evt: Event) => void;
  deviceId: string;
  fileUrl: string;
  subjectDetails: string;
  appName: string;
  value: any;
  emailContent: any;
  charsLeft: any;
  len: any;
  charEntered: boolean;
  loader: any;
  profile: any = {
    board: [],
    medium: [],
    grade:[],
    subject: []
  };
  boardValue: string;
  mediumtValue: string;
  gradeValue: string;
  subjectValue: string;
  
  public syllabusList: { name: string, code: string }[] = [];
  public mediumList: { name: string, code: string }[] = [];
  public gradeList: { name: string, code: string }[] = [];
  public subjectList: { name: string, code: string }[] = [];

  btnColor = '#8FC4FF';
  preFillData: any;
  subcategory: any;
  formConfig: any;

  headerObservable: any;
  isFormValid: boolean;
  formValues: any;
  boardContact: { code: string; name: string; message: string; contactinfo: { number: string; email: any; }; };
  bmgsString: any;
  categories: any;
  cnotextasdas: { [key: string]: { code: string; path?: string[]; }[]; };
  callToAction: any = {};
  showSupportContact: boolean;
  showThanksResponse: boolean;
  formContext: any;
  supportEmail: any;

  constructor(
    private router: Router,
    @Inject('SHARED_PREFERENCES') private preferences: SharedPreferences,
    @Inject('PROFILE_SERVICE') private profileService: ProfileService,
    @Inject('CONTENT_SERVICE') private contentService: ContentService,
    @Inject('DEVICE_INFO') private deviceInfo: DeviceInfo,
    @Inject('FRAMEWORK_SERVICE') private frameworkService: FrameworkService,
    @Inject('FRAMEWORK_UTIL_SERVICE') private frameworkUtilService: FrameworkUtilService,
    @Inject('TELEMETRY_SERVICE') private telemetryService: TelemetryService,
    private telemetryGeneratorService: TelemetryGeneratorService,
    private appGlobalService: AppGlobalService,
    private commonUtilService: CommonUtilService,
    private headerService: AppHeaderService,
    private location: Location,
    private socialSharing: SocialSharing,
    private appVersion: AppVersion,
    private translate: TranslateService,
    private modalCtrl: ModalController,
    public zone: NgZone,
    private formAndFrameworkUtilService: FormAndFrameworkUtilService
  ) {
    if (this.router.getCurrentNavigation().extras.state) {
      this.data = this.router.getCurrentNavigation().extras.state.data;
      this.formContext = this.router.getCurrentNavigation().extras.state.formCnotext;
      if (this.router.getCurrentNavigation().extras.state.showHeader) {
        this.headerService.showHeaderWithBackButton();
        this.headerObservable = this.headerService.headerEventEmitted$.subscribe(eventName => {
          this.handleHeaderEvents(eventName);
        });
      }
      this.formConfig = this.appGlobalService.formConfig;
      this.arrayListHandling(this.formConfig);
      console.log('prepared config', this.formConfig);
    }
    this.profileService.getActiveSessionProfile({ requiredFields: ProfileConstants.REQUIRED_FIELDS }).toPromise()
      .then((res: any) => {
        this.profile = res;
      })
      .catch(async () => {
        await this.loader.dismiss();
      });
  }

  private handleHeaderEvents($event) {
    switch ($event.name) {
      case 'back':
        setTimeout(() => {
          this.handleBackButton();
        }, 100);
        break;
    }
  }

  handleBackButton() {
    this.location.back();
  }

  async getBoardDetails() {
    this.loader = await this.commonUtilService.getLoader();
    await this.loader.present();

    const getSuggestedFrameworksRequest: GetSuggestedFrameworksRequest = {
      from: CachedItemRequestSourceFrom.SERVER,
      language: this.translate.currentLang,
      requiredCategories: FrameworkCategoryCodesGroup.DEFAULT_FRAMEWORK_CATEGORIES
    };

    this.frameworkUtilService.getActiveChannelSuggestedFrameworkList(getSuggestedFrameworksRequest).toPromise()
      .then(async (frameworks: Framework[]) => {
        if (!frameworks || !frameworks.length) {
          await this.loader.dismiss();
          this.commonUtilService.showToast('NO_DATA_FOUND');
          return;
        }
        this.syllabusList = frameworks.map(r => ({ name: r.name, code: r.identifier }));
        await this.loader.dismiss();
      });
  }

  ngOnInit() {
    this.appVersion.getAppName()
      .then((appName) => {
        this.appName = appName;
        console.log('APpName', this.appName);
      });
    this.messageListener = (event) => {
      this.receiveMessage(event);
    };
    window.addEventListener('message', this.messageListener, false);
    this.telemetryGeneratorService.generateImpressionTelemetry(
      ImpressionType.VIEW,
      '',
      PageId.FAQ_REPORT_ISSUE,
      Environment.USER
    );
  }

  ngOnDestroy() {
    window.removeEventListener('message', this.messageListener);
    if (this.headerObservable) {
      this.headerObservable.unsubscribe();
    }
    this.appGlobalService.formConfig = null;
  }
  
  receiveMessage(event) {
    const values = new Map();
    values['values'] = event.data;
    console.log('Event.data', event.data);
    // send telemetry for all events except Initiate-Email
    if (event.data && event.data.action && event.data.action !== 'initiate-email-clicked') {
      this.generateInteractTelemetry(event.data.action, values);
    } else {
      event.data.initiateEmailBody = this.getBoardMediumGrade(event.data.initiateEmailBody) + event.data.initiateEmailBody;
      this.generateInteractTelemetry(event.data.action, values);
      // launch email sharing
      this.sendMessage(event.data.initiateEmailBody);
    }
  }

  async sendMessage(message: string) {
    const allUserProfileRequest: GetAllProfileRequest = {
      local: true,
      server: true
    };
    const contentRequest: ContentRequest = {
      contentTypes: ContentType.FOR_DOWNLOADED_TAB,
      audience: AudienceFilter.GUEST_TEACHER
    };
    const getUserCount = await this.profileService.getAllProfiles(allUserProfileRequest).pipe(
      map((profile) => profile.length)
    )
    .toPromise();
    const getLocalContentCount = await this.contentService.getContents(contentRequest).pipe(
      map((contentCount) => contentCount.length)
    )
    .toPromise();
    (<any>window).supportfile.shareSunbirdConfigurations(getUserCount, getLocalContentCount, async (result) => {
      const loader = await this.commonUtilService.getLoader();
      await loader.present();
      this.preferences.putString(KEY_SUNBIRD_CONFIG_FILE_PATH, result).toPromise()
        .then((resp) => {
          this.preferences.getString(KEY_SUNBIRD_CONFIG_FILE_PATH).toPromise()
            .then(async val => {
              await loader.dismiss();
              if (Boolean(val)) {
                this.fileUrl = 'file://' + val;
                this.subjectDetails = this.appName + ' ' + SUBJECT_NAME + ' for ' + this.categories;
                this.socialSharing.shareViaEmail(message,
                  this.subjectDetails,
                  [this.supportEmail ? this.supportEmail : this.appGlobalService.SUPPORT_EMAIL],
                  null,
                  null,
                  this.fileUrl)
                  .catch(error => {
                    console.error(error);
                  });
              }
            });
        });
    }, (error) => {
      console.error('ERROR - ' + error);
    });
  }
  generateInteractTelemetry(interactSubtype, values) {
    this.telemetryGeneratorService.generateInteractTelemetry(
      InteractType.TOUCH, interactSubtype,
      Environment.USER,
      PageId.FAQ_REPORT_ISSUE, undefined,
      values
    );
  }

  getBoardMediumGrade(mailBody: string): string {
    this.deviceId = this.deviceInfo.getDeviceID();
    const userProfile: Profile = this.appGlobalService.getCurrentUser();
    let ticketSummary: string;
    if (mailBody.length) {
      ticketSummary = '<br> <br> <strong>' + this.commonUtilService.translateMessage('TICKET_SUMMARY') + '</strong> <br> <br>';
    } else {
      ticketSummary = '<br> <br> <strong>' + this.commonUtilService.translateMessage('MORE_DETAILS') + '</strong> <br> <br>';
    }
    let userDetails: string;
    if (this.bmgsString) {
      userDetails = 'From: ' + userProfile.profileType[0].toUpperCase() + userProfile.profileType.slice(1) + ', ' +
        this.bmgsString
    } else {
      userDetails = 'From: ' + userProfile.profileType[0].toUpperCase() + userProfile.profileType.slice(1) + ', ' +
        this.appGlobalService.getSelectedBoardMediumGrade() + ticketSummary;
    }
    this.categories ? userDetails += '.<br> <br>' + this.commonUtilService.translateMessage('DEVICE_ID') + ': ' + this.deviceId + '<br>'
      : null;
    userDetails += ticketSummary;
    return userDetails;
  }

  submit() {
    this.prepareEmailContent(this.formValues);

    if (this.formValues && this.formValues.subcategory) {
      if (Object.prototype.hasOwnProperty.call(this.callToAction, this.formValues.subcategory)) {
        this.takeAction(this.callToAction[this.formValues.subcategory]);
      } else if (Object.prototype.hasOwnProperty.call(this.callToAction, this.formValues.category)) {
        this.takeAction(this.callToAction[this.formValues.category]);
      } else {
        this.takeAction();
      }
    }
    if (this.formValues && this.formValues.children && this.formValues.children.subcategory &&
    this.formValues.children.subcategory.notify) {
      const corRelationList: Array<CorrelationData> = this.prepareTelemetryCorrelation();
      this.telemetryGeneratorService.generateInteractTelemetry(
        InteractType.SUPPORT,
        '', Environment.HOME,
        PageId.FAQ_REPORT_ISSUE,
        undefined,
        undefined,
        undefined,
        corRelationList,
        ID.NOTIFICATION_REQUEST
      );
    }
    this.syncTelemetry();
  }

  takeAction(action?: string) {
    switch(action) {
      case 'contactBoard':
        this.showContactBoard();
        break;
      case 'initiateEmail':
        this.initiateEmailAction();
        break;
      default:
        if (this.formContext === FormConfigSubcategories.CONTENT_AVAILABILITY) {
          this.openExploreBooksComponent();
        } else {
          this.ackknowledgeResponse();
        }
      }
  }

  async openExploreBooksComponent() {
    // generate telemetry and send class, medium and subject data to next page
    const sortOptionsModal = await this.modalCtrl.create({
      component: ExploreBooksSortComponent,
      componentProps:
      {
        boardList: (this.formValues.children && this.formValues.children.subcategory && this.formValues.children.subcategory.board) ?
        [this.formValues.children.subcategory.board.name] : null,
        mediumList: (this.formValues.children && this.formValues.children.subcategory && this.formValues.children.subcategory.medium) ?
        [this.formValues.children.subcategory.medium.name] : null,
        geadeList: (this.formValues.children && this.formValues.children.subcategory && this.formValues.children.subcategory.grade) ?
        [this.formValues.children.subcategory.grade.name] : null,
        curLang: this.translate.currentLang
      }
    });
    this.location.back();
    await sortOptionsModal.present();
  }

  ackknowledgeResponse() {
    // show acknowdelgement message
    this.showThanksResponse = true;
    setTimeout(() => {
      this.showThanksResponse = false;
    }, 3000);
  }

  async initiateEmailAction() {
    const stateContactList = await this.formAndFrameworkUtilService.getStateContactList();
    this.supportEmail = undefined;
    stateContactList.forEach(element => {
      if (this.formValues.children.subcategory.board.code === element.id) {
        this.supportEmail = element.contactinfo && element.contactinfo.email ? element.contactinfo.email : undefined;
      }
    });
    if (!this.showSupportContact && this.isFormValid) {
      this.value = {};
      this.value.action = 'initiate-email-clicked';
      this.value.value = {};
      this.value.initiateEmailBody = this.formValues.children.subcategory.details;
      window.parent.postMessage(this.value, '*');
    }
  }

  async showContactBoard() {
    const stateContactList = await this.formAndFrameworkUtilService.getStateContactList();
    stateContactList.forEach(element => {
      if (this.formValues.children.subcategory.board.code === element.id) {
        if (this.isFormValid) {
          this.boardContact = element;
          this.showSupportContact = true;
        }
      }
    });
    this.initiateEmailAction();
  }

  countChar(val) {
    const maxLength = 1000;
    this.len = val.length;
    if (this.len === 0) {
      this.charEntered = false;
    }
    if (this.len > 0 && this.len <= 1000) {
      this.charEntered = true;
      this.charsLeft = maxLength - this.len;
    }
    if (val.length > 1000) {
      this.emailContent = this.emailContent.slice(0, 1000);
    }
  }

  prepareTelemetryCorrelation(): Array<CorrelationData> {
    const correlationlist: Array<CorrelationData> = [];
    // Category
    this.formValues && this.formValues.category ?
    correlationlist.push({ id: this.formValues.category, type: CorReleationDataType.CATEGORY }) : null;
    // SubCategory
    this.formValues && this.formValues.subcategory ?
    correlationlist.push({ id: this.formValues.subcategory, type: CorReleationDataType.SUBCATEGORY }) : null;
    if (this.formValues && this.formValues.children && this.formValues.children.subcategory) {
      // Board
      this.formValues.children.subcategory.board && this.formValues.children.subcategory.board.name ?
      correlationlist.push({ id: this.formValues.children.subcategory.board.name, type: CorReleationDataType.BOARD }) : null;
      // Medium
      this.formValues.children.subcategory.medium && this.formValues.children.subcategory.medium.name ?
      correlationlist.push({ id: this.formValues.children.subcategory.medium.name, type: CorReleationDataType.MEDIUM }) : null;
      // Grade
      this.formValues.children.subcategory.grade && this.formValues.children.subcategory.grade.name ?
      correlationlist.push({ id: this.formValues.children.subcategory.grade.name, type: CorReleationDataType.CLASS }) : null;
      // Subject
      this.formValues.children.subcategory.subject && this.formValues.children.subcategory.subject.name ?
      correlationlist.push({ id: this.formValues.children.subcategory.subject.name, type: CorReleationDataType.SUBJECT }) : null;
    }

    return correlationlist ? correlationlist : null;
  }

  async syncTelemetry() {
    const that = this;
    const loader = await this.commonUtilService.getLoader();
    await loader.present();
    const correlationlist: Array<CorrelationData> = this.prepareTelemetryCorrelation();
    
    this.generateInteractEvent(InteractType.TOUCH, InteractSubtype.MANUALSYNC_INITIATED, null);
    this.telemetryService.sync({
      ignoreAutoSyncMode: true,
      ignoreSyncThreshold: true
    }).subscribe((syncStat: TelemetrySyncStat) => {
        that.zone.run(async () => {
          if (syncStat.error) {
            await loader.dismiss();
            console.error('Telemetry Data Sync Error: ', syncStat);
            return;
          } else if (!syncStat.syncedEventCount) {
            await loader.dismiss();
            console.error('Telemetry Data Sync Error: ', syncStat);
            return;
          }

          this.generateInteractEvent(InteractType.OTHER, InteractSubtype.MANUALSYNC_SUCCESS, syncStat.syncedFileSize, correlationlist);
          await loader.dismiss();
          console.log('Telemetry Data Sync Success: ', syncStat);
        });
      }, async (error) => {
        await loader.dismiss();
        console.error('Telemetry Data Sync Error: ', error);
      });
  }

  generateInteractEvent(interactType: string, subtype: string, size: number, corRelationList?) {
    /*istanbul ignore else */
    if (size != null) {
      this.telemetryGeneratorService.generateInteractTelemetry(
        interactType,
        subtype,
        Environment.USER,
        PageId.FAQ_REPORT_ISSUE,
        undefined,
        {
          SizeOfFileInKB: (size / 1000) + ''
        },
        undefined,
        corRelationList
      );
    }
  }

  // checks for dataSrc property
  checkDataSrc(obj) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, 'dataSrc')) {
      // attaching closure to options preperty
      this.converDataSrcToClosure(obj);
    } else if (obj) {
      for (const key in obj) {
        if (Array.isArray(obj[key])) {
          this.arrayListHandling(obj[key]);
        } else if (typeof obj[key] === 'object') {
          this.checkDataSrc(obj[key]);
        }
      }
    }
  }

  arrayListHandling(arr, action?) {
    arr.forEach(element => {
      if (arr && Array.isArray(element)) {
        this.arrayListHandling(element);
      } else if (typeof element === 'object') {
        if (typeof action === 'function') {
          action(element);
        } else {
          this.checkDataSrc(element);
        }
      }
    });
  }

  converDataSrcToClosure(templateOptions) { // type definition
    const dataSrc = templateOptions.dataSrc;
    switch (dataSrc.marker) {
      case 'ACTIVE_CHANNEL.SUGGESTED_FRAMEWORK_LIST.MAPPED_TO_FRAMEWORKCATEGORIES':
        templateOptions.options = this.getClosure('board');
        // delete templateOptions.dataSrc;
        break;
      case 'FRAMEWORK_CATEGORY_TERMS':
        templateOptions.options = this.getClosure(dataSrc.params.categoryCode);
        // delete templateOptions.dataSrc;
        break;
    }
    if (dataSrc && dataSrc.action) {
      this.callToAction[templateOptions.value] = dataSrc.action;
    }
  }

  getClosure(type: string) {
    // Board Closure
    const boardClosure: FieldConfigOptionsBuilder<{ name: string, code: string, deafult?: any }> = ((control: FormControl, _, notifyLoading, notifyLoaded) => {
      return defer(async () => {
        notifyLoading();
        const getSuggestedFrameworksRequest: GetSuggestedFrameworksRequest = {
          from: CachedItemRequestSourceFrom.SERVER,
          language: this.translate.currentLang,
          requiredCategories: FrameworkCategoryCodesGroup.DEFAULT_FRAMEWORK_CATEGORIES
        };

        const list = await this.frameworkUtilService.getActiveChannelSuggestedFrameworkList(getSuggestedFrameworksRequest).toPromise();
        const options: FieldConfigOption<{ name: string, code: string }>[] = [];
        list.forEach(element => {
          const value: FieldConfigOption<{ name: string, code: string}> = {
            label: element.name,
            value: {
              name: element.name,
              code: element.identifier
            }
          };
          options.push(value);

          if (this.profile && this.profile.syllabus && this.profile.syllabus.length
          && this.profile.syllabus[0] === element.identifier) {
            control.patchValue(value.value);
          }
        });
        notifyLoaded();
        return options;
      }).pipe(
        catchError((e) => {
          console.error(e);
          notifyLoaded();
          return EMPTY;
        })
      );
    });

    // Medium Closure
    const mediumClosure: FieldConfigOptionsBuilder<{ name: string, code: string, frameworkCode: string }> = ((control: FormControl, context: FormControl, notifyLoading, notifyLoaded) => {
      if (!context) {
        return of([]);
      }
      return context.valueChanges.pipe(
        distinctUntilChanged((v1, v2) => {
          return this.valueComparator(v1 && v1.code, v2 && v2.code);
        }),
        tap(notifyLoading),
        switchMap((value) => {
          if (!value) {
            return of([]);
          }
          const userInput: { name: string, code: string } = value;
          return defer(async () => {
            const framework = await this.frameworkService.getFrameworkDetails({
              from: CachedItemRequestSourceFrom.SERVER,
              frameworkId: userInput.code,
              requiredCategories: FrameworkCategoryCodesGroup.DEFAULT_FRAMEWORK_CATEGORIES
            }).toPromise();

            const boardCategoryTermsRequet: GetFrameworkCategoryTermsRequest = {
              frameworkId: userInput.code,
              requiredCategories: [FrameworkCategoryCode.BOARD],
              currentCategoryCode: FrameworkCategoryCode.BOARD,
              language: this.translate.currentLang
            };

            const boardTerm = (await this.frameworkUtilService.getFrameworkCategoryTerms(boardCategoryTermsRequet).toPromise()).
              find(b => b.name === userInput.name);

            const nextCategoryTermsRequet: GetFrameworkCategoryTermsRequest = {
              frameworkId: framework.code,
              requiredCategories: [FrameworkCategoryCode.MEDIUM],
              prevCategoryCode: FrameworkCategoryCode.BOARD,
              currentCategoryCode: FrameworkCategoryCode.MEDIUM,
              language: this.translate.currentLang,
              selectedTermsCodes: [boardTerm.code]
            };

            const list = await this.frameworkUtilService.getFrameworkCategoryTerms(nextCategoryTermsRequet).toPromise();
            const options: FieldConfigOption<{ name: string, code: string, frameworkCode: string }>[] = [];
            list.forEach(element => {
              const value: FieldConfigOption<{ name: string, code: string, frameworkCode: string }> = {
                label: element.name,
                value: {
                  name: element.name,
                  code: element.code,
                  frameworkCode: framework.code
                }
              };
              options.push(value);

              if (this.profile && this.profile.medium && this.profile.medium.length
              && this.profile.medium[0] === element.code) {
                control.patchValue(value.value);
              }
            });
            return options;
          });
        }),
        tap(notifyLoaded),
        catchError((e) => {
          console.error(e);
          notifyLoaded();
          return EMPTY;
        })
      );
    });

    // Grade Closure
    const gradeClosure: FieldConfigOptionsBuilder<{ name: string, code: string, frameworkCode: string }> = ((control: FormControl, context: FormControl, notifyLoading, notifyLoaded) => {
      if (!context) {
        return of([]);
      }
      return context.valueChanges.pipe(
        distinctUntilChanged((v1, v2) => {
          return this.valueComparator(v1 && v1.code, v2 && v2.code);
        }),
        tap(notifyLoading),
        switchMap((value) => {
          if (!value) {
            return of([]);
          }
          const userInput: { name: string, code: string, frameworkCode: string } = value;
          return defer(async () => {
            const nextCategoryTermsRequet: GetFrameworkCategoryTermsRequest = {
              frameworkId: userInput.frameworkCode,
              requiredCategories: [FrameworkCategoryCode.GRADE_LEVEL],
              prevCategoryCode: FrameworkCategoryCode.MEDIUM,
              currentCategoryCode: FrameworkCategoryCode.GRADE_LEVEL,
              language: this.translate.currentLang,
              selectedTermsCodes: [context.value.code]
            };
    
            const list = (await this.frameworkUtilService.getFrameworkCategoryTerms(nextCategoryTermsRequet).toPromise());
            const options: FieldConfigOption<{ name: string, code: string, frameworkCode: string }>[] = [];
            list.forEach(element => {
              const value: FieldConfigOption<{ name: string, code: string, frameworkCode: string }> = {
                label: element.name,
                value: {
                  name: element.name,
                  code: element.code,
                  frameworkCode: userInput.frameworkCode
                }
              };
              options.push(value);

              if (this.profile && this.profile.grade && this.profile.grade.length
              && this.profile.grade[0] === element.code) {
                control.patchValue(value.value);
              }
            });
            return options;
          });
        }),
        tap(notifyLoaded),
        catchError((e) => {
          console.error(e);
          notifyLoaded();
          return EMPTY;
        })
      );
      
    });

    // Subject Closure
    const subjectClosure: FieldConfigOptionsBuilder<{ name: string, code: string, frameworkCode: string }> = ((control: FormControl, context: FormControl, notifyLoading, notifyLoaded) => {
      if (!context) {
        return of([]);
      }
      return context.valueChanges.pipe(
        distinctUntilChanged((v1, v2) => {
          return this.valueComparator(v1 && v1.code, v2 && v2.code);
        }),
        tap(notifyLoading),
        switchMap((value) => {
          if (!value) {
            return of([]);
          }
          const userInput: { name: string, code: string, frameworkCode: string } = value;
          return defer(async () => {
            const nextCategoryTermsRequet: GetFrameworkCategoryTermsRequest = {
              frameworkId: userInput.frameworkCode,
              requiredCategories: [FrameworkCategoryCode.SUBJECT],
              prevCategoryCode: FrameworkCategoryCode.GRADE_LEVEL,
              currentCategoryCode: FrameworkCategoryCode.SUBJECT,
              language: this.translate.currentLang,
              selectedTermsCodes: [context.value.code]
            };

            const list = (await this.frameworkUtilService.getFrameworkCategoryTerms(nextCategoryTermsRequet).toPromise());
            const options: FieldConfigOption<{ name: string, code: string, frameworkCode: string }>[] = [];
            list.forEach(element => {
              const value: FieldConfigOption<{ name: string, code: string, frameworkCode: string }> = {
                label: element.name,
                value: {
                  name: element.name,
                  code: element.code,
                  frameworkCode: userInput.frameworkCode
                }
              };
              options.push(value);

              if (this.profile && this.profile.subject && this.profile.subject.length
              && this.profile.subject[0] === element.code) {
                control.patchValue(value.value);
              }
            });
            return options;
          });
        }),
        tap(notifyLoaded),
        catchError((e) => {
          console.error(e);
          notifyLoaded();
          return EMPTY;
        })
      );
    });

    switch (type) {
      case 'board':
        return boardClosure;
      case 'medium':
        return mediumClosure;
      case 'grade':
        return gradeClosure;
      case 'subject':
        return subjectClosure;
    }
  }

  valueChanged($event) {
      console.log('value changes', $event);
      this.formValues = $event;
      if (!this.formContext && $event.category === 'otherissues') {
        this.formConfig[1].templateOptions.hidden = true;
      } else if (!this.formContext) {
        this.formConfig[1].templateOptions.hidden = false;
      }
  }

  prepareEmailContent(formValue) {
    this.bmgsString = null;
    this.categories = null;
    const bmgskeys = ['board', 'medium', 'grade', 'subject', 'contentname'];
    const categorykeys = ['category', 'subcategory'];
    let fields = [];
    if (formValue.children.subcategory) {
      fields = formValue.children.subcategory;
    } else if (formValue.children) {
      fields = formValue.children;
    }
    bmgskeys.forEach(element => {
      if (Object.prototype.hasOwnProperty.call(fields, element)) {
        if (!this.bmgsString) {
          this.bmgsString = fields[element].name;
        } else {
          this.bmgsString += ", " + (fields[element].name ? fields[element].name : fields[element]);
        }
      }
    });
    categorykeys.forEach(element => {
      if (Object.prototype.hasOwnProperty.call(formValue, element)) {
        if (!this.categories) {
          formValue[element] ? this.categories = formValue[element]: null;
        } else {
          formValue[element] ? this.categories += " - " + formValue[element]: null;
        }
      }
    });
  }

  statusChanged($event) {
    console.log('statusChanged', $event);
    this.isFormValid = $event.isValid;
    this.btnColor = this.isFormValid ? '#006DE5' : '#8FC4FF';
  }

  private valueComparator(v1: any, v2: any): boolean {
    if (typeof v1 === 'object' && typeof v2 === 'object') {
      return (JSON.stringify(v1) !== JSON.stringify(v2));
    } else if (v1 === v2) {
      return true;
    } else if (!v1 && !v2) {
      return true;
    }
    return false;
  }

  async dataLoadStatus($event) {
    console.log($event);
    if (!this.loader) {
      this.loader = await this.commonUtilService.getLoader();
    }
    if ("LOADING" === $event){
      this.loader.present();
    } else {
      this.loader.dismiss();
    }
  }

  responseSubmitted() {
    if (this.formContext !== FormConfigSubcategories.CONTENT_AVAILABILITY) {
      this.location.back();
    }
  }
}
