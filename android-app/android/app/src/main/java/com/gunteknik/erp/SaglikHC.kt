package com.gunteknik.erp

import android.content.Context
import android.content.Intent
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.aggregate.AggregationResult
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.FloorsClimbedRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.NutritionRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.Period
import java.time.ZoneId
import kotlin.reflect.KClass

/**
 * Health Connect köprüsü (Mi Fitness → saat verisi, Foodvisor → beslenme).
 * Yalnız OKUR. Sonuç JSON olarak ERP'ye (saglik.js) döner; ERP kendi Supabase tablolarına yazar.
 */
object SaglikHC {

    fun interface Sonuc { fun bitti(json: String?, hata: String?) }

    private const val SAGLAYICI = "com.google.android.apps.healthdata"
    private val kapsam = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val TURLER: List<KClass<out Record>> = listOf(
        StepsRecord::class, DistanceRecord::class, ActiveCaloriesBurnedRecord::class, TotalCaloriesBurnedRecord::class,
        FloorsClimbedRecord::class, SleepSessionRecord::class, HeartRateRecord::class, RestingHeartRateRecord::class,
        OxygenSaturationRecord::class, WeightRecord::class, BodyFatRecord::class, BloodPressureRecord::class,
        NutritionRecord::class, ExerciseSessionRecord::class
    )

    @JvmStatic
    fun izinler(): Set<String> =
        TURLER.map { HealthPermission.getReadPermission(it) }.toSet() + HealthPermission.PERMISSION_READ_HEALTH_DATA_HISTORY

    /** 0 yok, 1 güncelleme gerekli, 2 hazır */
    @JvmStatic
    fun sdk(ctx: Context): Int = when (HealthConnectClient.getSdkStatus(ctx, SAGLAYICI)) {
        HealthConnectClient.SDK_AVAILABLE -> 2
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> 1
        else -> 0
    }

    @JvmStatic
    fun izinIntent(ctx: Context): Intent =
        PermissionController.createRequestPermissionResultContract().createIntent(ctx, izinler())

    @JvmStatic
    fun durum(ctx: Context, s: Sonuc) {
        val d = sdk(ctx)
        if (d != 2) { s.bitti(JSONObject().put("sdk", d).put("izinler", JSONArray()).toString(), null); return }
        kapsam.launch {
            try {
                val v = HealthConnectClient.getOrCreate(ctx).permissionController.getGrantedPermissions()
                val L = JSONArray(); v.forEach { L.put(it.substringAfterLast('.')) }
                s.bitti(JSONObject().put("sdk", 2).put("izinler", L).put("tam", v.containsAll(izinler())).toString(), null)
            } catch (e: Exception) { s.bitti(null, e.message ?: e.toString()) }
        }
    }

    @JvmStatic
    fun oku(ctx: Context, gunSay: Int, s: Sonuc) {
        if (sdk(ctx) != 2) { s.bitti(null, "Health Connect bu telefonda yok ya da güncellenmeli"); return }
        kapsam.launch {
            try { s.bitti(okuIc(ctx, gunSay.coerceIn(1, 400)).toString(), null) }
            catch (e: Exception) { s.bitti(null, e.message ?: e.toString()) }
        }
    }

    private fun izinli(v: Set<String>, k: KClass<out Record>) = v.contains(HealthPermission.getReadPermission(k))

    private suspend fun <T : Record> hepsi(c: HealthConnectClient, k: KClass<T>, bas: Instant, bit: Instant): List<T> {
        val L = ArrayList<T>(); var tok: String? = null
        do {
            val r = c.readRecords(ReadRecordsRequest(recordType = k, timeRangeFilter = TimeRangeFilter.between(bas, bit), pageSize = 1000, pageToken = tok))
            L.addAll(r.records); tok = r.pageToken
        } while (!tok.isNullOrEmpty() && L.size < 20000)
        return L
    }

    private suspend fun okuIc(ctx: Context, gunSay: Int): JSONObject {
        val c = HealthConnectClient.getOrCreate(ctx)
        val v = c.permissionController.getGrantedPermissions()
        val bolge = ZoneId.systemDefault()
        val ilkGun = LocalDate.now(bolge).minusDays((gunSay - 1).toLong())
        val basL = ilkGun.atStartOfDay(); val bitL = LocalDate.now(bolge).plusDays(1).atStartOfDay()
        val bas = basL.atZone(bolge).toInstant(); val bit = bitL.atZone(bolge).toInstant()
        val gunler = LinkedHashMap<String, JSONObject>()
        fun gun(t: String) = gunler.getOrPut(t) { JSONObject().put("tarih", t) }

        // günlük toplamlar (izin olan metrikler)
        val M = LinkedHashMap<String, AggregateMetric<*>>()
        if (izinli(v, StepsRecord::class)) M["adim"] = StepsRecord.COUNT_TOTAL
        if (izinli(v, DistanceRecord::class)) M["mesafe_m"] = DistanceRecord.DISTANCE_TOTAL
        if (izinli(v, ActiveCaloriesBurnedRecord::class)) M["aktif_kcal"] = ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL
        if (izinli(v, TotalCaloriesBurnedRecord::class)) M["toplam_kcal"] = TotalCaloriesBurnedRecord.ENERGY_TOTAL
        if (izinli(v, FloorsClimbedRecord::class)) M["kat"] = FloorsClimbedRecord.FLOORS_CLIMBED_TOTAL
        if (izinli(v, HeartRateRecord::class)) { M["nabiz_min"] = HeartRateRecord.BPM_MIN; M["nabiz_max"] = HeartRateRecord.BPM_MAX; M["nabiz_ort"] = HeartRateRecord.BPM_AVG }
        if (izinli(v, RestingHeartRateRecord::class)) M["nabiz_dinlenik"] = RestingHeartRateRecord.BPM_AVG
        if (izinli(v, NutritionRecord::class)) {
            M["kcal_alinan"] = NutritionRecord.ENERGY_TOTAL; M["protein_g"] = NutritionRecord.PROTEIN_TOTAL
            M["karb_g"] = NutritionRecord.TOTAL_CARBOHYDRATE_TOTAL; M["yag_g"] = NutritionRecord.TOTAL_FAT_TOTAL
            M["lif_g"] = NutritionRecord.DIETARY_FIBER_TOTAL; M["seker_g"] = NutritionRecord.SUGAR_TOTAL
        }
        if (M.isNotEmpty()) {
            val G = c.aggregateGroupByPeriod(AggregateGroupByPeriodRequest(metrics = M.values.toSet(), timeRangeFilter = TimeRangeFilter.between(basL, bitL), timeRangeSlicer = Period.ofDays(1)))
            for (g in G) {
                val t = g.startTime.toLocalDate().toString(); var var_ = false; val o = JSONObject()
                for ((ad, m) in M) { val x = deger(g.result, m) ?: continue; o.put(ad, x); var_ = true }
                if (var_) { val d = gun(t); o.keys().forEach { d.put(it, o.get(it)) } }
            }
        }

        // uyku: uyanılan güne yazılır (sabah formu "dün gece" ile aynı gün)
        if (izinli(v, SleepSessionRecord::class)) {
            for (u in hepsi(c, SleepSessionRecord::class, bas.minusSeconds(86400), bit)) {
                val t = u.endTime.atZone(bolge).toLocalDate(); if (t.isBefore(ilkGun)) continue
                val d = gun(t.toString())
                var derin = 0L; var rem = 0L; var hafif = 0L; var uyanik = 0L
                for (e in u.stages) {
                    val dk = (e.endTime.epochSecond - e.startTime.epochSecond) / 60
                    when (e.stage) {
                        SleepSessionRecord.STAGE_TYPE_DEEP -> derin += dk
                        SleepSessionRecord.STAGE_TYPE_REM -> rem += dk
                        SleepSessionRecord.STAGE_TYPE_LIGHT, SleepSessionRecord.STAGE_TYPE_SLEEPING -> hafif += dk
                        SleepSessionRecord.STAGE_TYPE_AWAKE, SleepSessionRecord.STAGE_TYPE_AWAKE_IN_BED, SleepSessionRecord.STAGE_TYPE_OUT_OF_BED -> uyanik += dk
                    }
                }
                val top = (u.endTime.epochSecond - u.startTime.epochSecond) / 60
                val uyku = if (derin + rem + hafif > 0) derin + rem + hafif else top - uyanik
                d.put("uyku_dk", d.optLong("uyku_dk", 0) + uyku)
                d.put("uyku_derin_dk", d.optLong("uyku_derin_dk", 0) + derin); d.put("uyku_rem_dk", d.optLong("uyku_rem_dk", 0) + rem)
                d.put("uyku_hafif_dk", d.optLong("uyku_hafif_dk", 0) + hafif); d.put("uyku_uyanik_dk", d.optLong("uyku_uyanik_dk", 0) + uyanik)
                if (!d.has("uyku_bas") || u.startTime.toString() < d.getString("uyku_bas")) d.put("uyku_bas", u.startTime.toString())
                if (!d.has("uyku_bit") || u.endTime.toString() > d.getString("uyku_bit")) d.put("uyku_bit", u.endTime.toString())
            }
        }
        if (izinli(v, OxygenSaturationRecord::class)) {
            val top = HashMap<String, DoubleArray>()
            for (r in hepsi(c, OxygenSaturationRecord::class, bas, bit)) {
                val t = r.time.atZone(bolge).toLocalDate().toString(); val a = top.getOrPut(t) { DoubleArray(2) }; a[0] += r.percentage.value; a[1] += 1.0
            }
            top.forEach { (t, a) -> gun(t).put("spo2", Math.round(a[0] / a[1] * 10) / 10.0) }
        }

        // tekil ölçümler
        val olc = JSONArray()
        if (izinli(v, WeightRecord::class)) for (r in hepsi(c, WeightRecord::class, bas, bit))
            olc.put(JSONObject().put("tur", "kilo").put("deger", Math.round(r.weight.inKilograms * 10) / 10.0).put("zaman", r.time.toString()).put("dis_id", "hc:" + r.metadata.id))
        if (izinli(v, BodyFatRecord::class)) for (r in hepsi(c, BodyFatRecord::class, bas, bit))
            olc.put(JSONObject().put("tur", "yag").put("deger", Math.round(r.percentage.value * 10) / 10.0).put("zaman", r.time.toString()).put("dis_id", "hc:" + r.metadata.id))
        if (izinli(v, BloodPressureRecord::class)) for (r in hepsi(c, BloodPressureRecord::class, bas, bit))
            olc.put(JSONObject().put("tur", "tansiyon").put("deger", Math.round(r.systolic.inMillimetersOfMercury)).put("deger2", Math.round(r.diastolic.inMillimetersOfMercury)).put("zaman", r.time.toString()).put("dis_id", "hc:" + r.metadata.id))

        // egzersiz oturumları
        val akt = JSONArray()
        if (izinli(v, ExerciseSessionRecord::class)) {
            for (r in hepsi(c, ExerciseSessionRecord::class, bas, bit)) {
                val o = JSONObject().put("dis_id", "hc:" + r.metadata.id).put("tur", tur(r.exerciseType)).put("baslangic", r.startTime.toString()).put("bitis", r.endTime.toString())
                    .put("sure_sn", r.endTime.epochSecond - r.startTime.epochSecond).put("kaynak_uyg", r.metadata.dataOrigin.packageName)
                if (r.title != null) o.put("ad", r.title)
                val SM = LinkedHashMap<String, AggregateMetric<*>>()
                if (izinli(v, DistanceRecord::class)) SM["mesafe_m"] = DistanceRecord.DISTANCE_TOTAL
                if (izinli(v, ActiveCaloriesBurnedRecord::class)) SM["kcal"] = ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL
                if (izinli(v, HeartRateRecord::class)) { SM["nabiz_ort"] = HeartRateRecord.BPM_AVG; SM["nabiz_max"] = HeartRateRecord.BPM_MAX }
                if (SM.isNotEmpty()) try {
                    val a = c.aggregate(AggregateRequest(metrics = SM.values.toSet(), timeRangeFilter = TimeRangeFilter.between(r.startTime, r.endTime)))
                    for ((ad, m) in SM) { val x = deger(a, m) ?: continue; o.put(ad, x) }
                } catch (_: Exception) {}
                akt.put(o)
            }
        }

        val gunL = JSONArray(); gunler.values.forEach { gunL.put(it) }
        return JSONObject().put("gunluk", gunL).put("olcum", olc).put("aktivite", akt).put("izinler", v.size)
    }

    @Suppress("UNCHECKED_CAST")
    private fun deger(r: AggregationResult, m: AggregateMetric<*>): Any? {
        val x: Any = r.get(m as AggregateMetric<Any>) ?: return null
        return when (x) {
            is Long -> x
            is Int -> x
            is Double -> Math.round(x * 10) / 10.0
            is androidx.health.connect.client.units.Length -> Math.round(x.inMeters)
            is androidx.health.connect.client.units.Energy -> Math.round(x.inKilocalories)
            is androidx.health.connect.client.units.Mass -> Math.round(x.inGrams * 10) / 10.0
            else -> null
        }
    }

    private fun tur(t: Int): String = when (t) {
        ExerciseSessionRecord.EXERCISE_TYPE_WALKING -> "yuruyus"
        ExerciseSessionRecord.EXERCISE_TYPE_RUNNING, ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL -> "kosu"
        ExerciseSessionRecord.EXERCISE_TYPE_BIKING, ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY -> "bisiklet"
        ExerciseSessionRecord.EXERCISE_TYPE_HIKING -> "trekking"
        ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING, ExerciseSessionRecord.EXERCISE_TYPE_CALISTHENICS,
        ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING, ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING -> "ev"
        else -> "diger"
    }
}
