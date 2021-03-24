import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService } from '../service/api.service';
import { DataPatient } from '../interfaces/dataPatient.interface';
// import { ValuesReturn, Values, Prediction, Datum, FHIRData } from '../interfaces/values.interface';
import { Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { PatientService } from '../service/patient.service';
import { ChartDataSets, ChartOptions, ChartType } from 'chart.js';
import { Color, Label } from 'ng2-charts';
import { Prediction, FHIRData, Datum } from '../interfaces/values.interface';
import { PredictionResult } from '../interfaces/predictionResult.interface';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})

export class HomePage implements OnInit {

  covidForm: FormGroup;
  dateObject: Date = new Date();
  predictionResult: Array<PredictionResult> = [];

  risques: object  = {
    fr_diabete : 'Diabete',
    fr_maladie_cardiovasculaire: 'Maladie Cardiovasculaire',
    fr_asthme: 'Asthme',
    fr_bpco: 'BPCO',
    fr_obese: 'Obésité'
  };

  symptomes: object  = {

    symp_fievre: 'Fièvre',
    symp_dyspnee : 'Difficultés respiratoires',
    symp_myalgies: 'Douleurs musculaires',
    symp_cephalees: 'Mal de tête',
    symp_toux: 'Toux',
    symp_digestifs: 'Troubles digestifs'
  };


  day: number = this.dateObject.getDay();
  month: number = this.dateObject.getMonth() + 1;
  year: number = this.dateObject.getFullYear();

  dataPatient: DataPatient = {

    idPatient: Math.floor(Math.random() * 10000),
    prenom: '',
    nom: '',
    age: 0,
    predictionDate: `${this.day}/${this.month}/${this.year}`,
    sexe: 0,
    facteurDeRisque: [],
    symptomes: [],
  };

  constructor(
    private formBuilder: FormBuilder,
    private api: ApiService,
    private patientService: PatientService
  ) {
      this.covidForm = this.formBuilder.group({
        nom: ['', Validators.pattern('[a-zA-ZÀ-ÖØ-öø-ÿ-\' ]*')],
        prenom: ['', Validators.pattern('[a-zA-ZÀ-ÖØ-öø-ÿ-\' ]*')],
        age: ['', Validators.pattern('[0-9]*')],
        sexe: ['', Validators.required],
        facteurDeRisque: [[''], Validators.required],
        symptomes: [[''], Validators.required]
      });
     }

chartLabels: Label[] = ['Random Forest', 'Neuronal Network', 'Gradient Boost Tree'];

chartOptions: ChartOptions = {
    responsive: true,
    scales: { xAxes: [{}], yAxes: [{}] },
    plugins: {
      datalabels: {
        anchor: 'end',
        align: 'end',
      }
    }
  };
  chartColors: Color[] = [
    // Couleur soins ambulatoire
    { backgroundColor: '#3DADF2' },
    // Couleur hospitalisation
    { backgroundColor: '#020F59' },
  ];

  chartType: ChartType = 'bar';
  chartLegend = true;
  // chartPlugins = [pluginDataLabels];
  chartsData: ChartDataSets[] = [];

closeMessage(): void {
  this.predictionResult.length = 0;
}

// Spinner
toggleSpinner(): void {
  document.querySelector('.container__spinner').classList.remove('invisible');
  document.querySelector('.container__spinner').classList.add('visible');
}

// Get data from API
sendDatas(): Observable<FHIRData> {
  this.dataPatient = this.patientService.updateDatasPatient(this.dataPatient, this.covidForm);
  const dataToSend: Array<object> = this.patientService.createBodyPost(this.dataPatient);
  // Zone de debug pour les données a envoyer
  console.log(dataToSend);
  return this.api.submitForm(dataToSend);
}

getPredictionResults(): Subscription  {

  if (this.predictionResult.length) { // Si une requete de prédiction a déja été faite
    this.closeMessage(); // On purge l'ancien résultat
  }

  this.toggleSpinner(); // On charge le spinner (loader) le temps d'avoir la réponse

  return this.sendDatas().pipe(

    // Map des données renvoyé pour faciliter la récupération des données à l'affichage
    // Création d'un template comme pour le patient sur this.predictionResult

    map(
      values => {

        // On récupère toutes les données renvoyées sous format FHIR
        // Et prépare les variables pour le template
        const data = values.data[0];
        const userName: string = data.subject.display;
        const idPatient: string = data.subject.reference;
        const predictions: Prediction[] = data.prediction;
        const summary: Partial<Prediction[]> = predictions.filter(prediction => prediction.rationale === 'summary');
        const pourcentage: number = Math.round(summary[0].probabilityDecimal * 100);
        const etatPrediction: string = summary[0].outcome.coding[0].code;

        // Le template démarre ici
        this.predictionResult.push(
          {
            idPatient: Number(idPatient),
            nomPatient: userName,
            summary,
            etatPrediction,
            pourcentage,
            tableauPredictionsBrut: predictions,
            valeursPredictions: {
              rfAmbulatoire: Math.round(predictions[0].probabilityDecimal * 100),
              rfHospitalise: Math.round(predictions[1].probabilityDecimal * 100),
              nnAmbulatoire: Math.round(predictions[2].probabilityDecimal * 100),
              nnHospitalise: Math.round(predictions[3].probabilityDecimal * 100),
              gbtAmbulatoire: Math.round(predictions[4].probabilityDecimal * 100),
              gbtHospitalise: Math.round(predictions[5].probabilityDecimal * 100),
            }
          }
        );

         // On configure le dataset pour les charts
        this.chartsData = [
          { data: [
            this.predictionResult[0].valeursPredictions.rfAmbulatoire,
            this.predictionResult[0].valeursPredictions.nnAmbulatoire,
            this.predictionResult[0].valeursPredictions.gbtAmbulatoire
            ], label: 'Soins Ambulatoire' },

          { data: [
            this.predictionResult[0].valeursPredictions.rfHospitalise,
            this.predictionResult[0].valeursPredictions.nnHospitalise,
            this.predictionResult[0].valeursPredictions.gbtHospitalise
          ], label: 'Hospitalisation' }
        ];
      }
    )
  )
.subscribe(
  // Zone de debug pour vérifier la nouvelle structure de données
   () => console.log(this.predictionResult)
);
}

ngOnInit() {
    document.querySelector('.container__spinner').classList.add('invisible');
  }
}
