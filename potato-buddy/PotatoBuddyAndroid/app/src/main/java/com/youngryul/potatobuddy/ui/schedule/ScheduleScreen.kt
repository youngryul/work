package com.youngryul.potatobuddy.ui.schedule

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.youngryul.potatobuddy.data.model.ScheduleItem
import com.youngryul.potatobuddy.data.repo.ScheduleRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter

data class ScheduleUiState(
    val yearMonth: YearMonth = YearMonth.now(),
    val selectedDate: LocalDate = LocalDate.now(),
    val schedules: List<ScheduleItem> = emptyList(),
    val dayItems: List<ScheduleItem> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val editing: ScheduleItem? = null,
    val isCreating: Boolean = false,
)

class ScheduleViewModel(
    private val scheduleRepository: ScheduleRepository,
) : ViewModel() {
    private val _ui = MutableStateFlow(ScheduleUiState())
    val ui: StateFlow<ScheduleUiState> = _ui.asStateFlow()
    private val dateFmt = DateTimeFormatter.ISO_LOCAL_DATE

    init {
        refresh()
    }

    fun refresh() {
        val ym = _ui.value.yearMonth
        val selected = _ui.value.selectedDate
        viewModelScope.launch {
            _ui.update { it.copy(isLoading = true, error = null) }
            try {
                val all = scheduleRepository.fetchSchedules(ym.year, ym.monthValue)
                val dayKey = selected.format(dateFmt)
                _ui.update {
                    it.copy(
                        schedules = all,
                        dayItems = scheduleRepository.forDate(all, dayKey),
                        isLoading = false,
                    )
                }
            } catch (e: Exception) {
                _ui.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    fun shiftMonth(delta: Long) {
        val next = _ui.value.yearMonth.plusMonths(delta)
        val selected = _ui.value.selectedDate.withYear(next.year).withMonth(next.monthValue)
            .withDayOfMonth(minOf(_ui.value.selectedDate.dayOfMonth, next.lengthOfMonth()))
        _ui.update { it.copy(yearMonth = next, selectedDate = selected) }
        refresh()
    }

    fun selectDate(date: LocalDate) {
        val key = date.format(dateFmt)
        _ui.update {
            it.copy(
                selectedDate = date,
                dayItems = scheduleRepository.forDate(it.schedules, key),
            )
        }
    }

    fun beginCreate() = _ui.update { it.copy(isCreating = true, editing = null) }

    fun beginEdit(item: ScheduleItem) = _ui.update { it.copy(editing = item, isCreating = false) }

    fun dismissForm() = _ui.update { it.copy(editing = null, isCreating = false) }

    fun save(title: String, tag: String, endDate: String?) {
        val selected = _ui.value.selectedDate.format(dateFmt)
        val end = endDate?.takeIf { it.isNotBlank() } ?: selected
        val editing = _ui.value.editing
        viewModelScope.launch {
            try {
                if (editing != null) {
                    scheduleRepository.updateSchedule(editing.id, selected, end, title, tag)
                } else {
                    scheduleRepository.createSchedule(selected, end, title, tag)
                }
                dismissForm()
                refresh()
            } catch (e: Exception) {
                _ui.update { it.copy(error = e.message) }
            }
        }
    }

    fun delete(id: String) {
        viewModelScope.launch {
            try {
                scheduleRepository.deleteSchedule(id)
                refresh()
            } catch (e: Exception) {
                _ui.update { it.copy(error = e.message) }
            }
        }
    }

    class Factory(private val repo: ScheduleRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T = ScheduleViewModel(repo) as T
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScheduleScreen(viewModel: ScheduleViewModel) {
    val state by viewModel.ui.collectAsState()
    var title by remember { mutableStateOf("") }
    var tag by remember { mutableStateOf("개인") }

    Scaffold(
        topBar = { TopAppBar(title = { Text("일정") }) },
        floatingActionButton = {
            FloatingActionButton(onClick = {
                title = ""
                tag = "개인"
                viewModel.beginCreate()
            }) {
                Icon(Icons.Filled.Add, contentDescription = "추가")
            }
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            MonthHeader(
                yearMonth = state.yearMonth,
                onPrev = { viewModel.shiftMonth(-1) },
                onNext = { viewModel.shiftMonth(1) },
            )
            MonthGrid(
                yearMonth = state.yearMonth,
                selected = state.selectedDate,
                markedDates = state.schedules.flatMap { item ->
                    val end = item.endDate?.takeIf { it.isNotBlank() } ?: item.scheduleDate
                    generateSequence(LocalDate.parse(item.scheduleDate)) { d ->
                        val n = d.plusDays(1)
                        if (n.toString() <= end) n else null
                    }.map { it.toString() }.toList()
                }.toSet(),
                onSelect = viewModel::selectDate,
            )

            if (state.isLoading) {
                Box(Modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }

            state.error?.let {
                Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(16.dp))
            }

            Text(
                "${state.selectedDate} 일정",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )

            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (state.dayItems.isEmpty()) {
                    item { Text("이 날의 일정이 없습니다.") }
                }
                items(state.dayItems, key = { it.id }) { item ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                title = item.title
                                tag = item.tag
                                viewModel.beginEdit(item)
                            },
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(item.title, style = MaterialTheme.typography.bodyLarge)
                                Text(
                                    item.tag.ifBlank { "개인" },
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            IconButton(onClick = { viewModel.delete(item.id) }) {
                                Icon(Icons.Filled.Delete, contentDescription = "삭제")
                            }
                        }
                    }
                }
            }
        }
    }

    if (state.isCreating || state.editing != null) {
        AlertDialog(
            onDismissRequest = viewModel::dismissForm,
            title = { Text(if (state.editing != null) "일정 수정" else "일정 추가") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("날짜: ${state.selectedDate}")
                    OutlinedTextField(
                        value = title,
                        onValueChange = { title = it },
                        label = { Text("제목") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = tag,
                        onValueChange = { tag = it },
                        label = { Text("태그") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (title.isNotBlank()) {
                            viewModel.save(title, tag, null)
                        }
                    },
                ) { Text("저장") }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissForm) { Text("취소") }
            },
        )
    }
}

@Composable
private fun MonthHeader(
    yearMonth: YearMonth,
    onPrev: () -> Unit,
    onNext: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        IconButton(onClick = onPrev) { Icon(Icons.Filled.ChevronLeft, null) }
        Text(
            "${yearMonth.year}년 ${yearMonth.monthValue}월",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
        )
        IconButton(onClick = onNext) { Icon(Icons.Filled.ChevronRight, null) }
    }
}

@Composable
private fun MonthGrid(
    yearMonth: YearMonth,
    selected: LocalDate,
    markedDates: Set<String>,
    onSelect: (LocalDate) -> Unit,
) {
    val firstDay = yearMonth.atDay(1)
    // Monday-first: Mon=0 … Sun=6
    val mondayFirstOffset = firstDay.dayOfWeek.value - 1
    val daysInMonth = yearMonth.lengthOfMonth()

    Column(modifier = Modifier.padding(horizontal = 12.dp)) {
        Row(modifier = Modifier.fillMaxWidth()) {
            listOf("월", "화", "수", "목", "금", "토", "일").forEach { label ->
                Text(
                    label,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.labelMedium,
                )
            }
        }
        val cells = mondayFirstOffset + daysInMonth
        val rows = (cells + 6) / 7
        repeat(rows) { row ->
            Row(modifier = Modifier.fillMaxWidth()) {
                repeat(7) { col ->
                    val index = row * 7 + col
                    val dayNum = index - mondayFirstOffset + 1
                    if (dayNum in 1..daysInMonth) {
                        val date = yearMonth.atDay(dayNum)
                        val isSelected = date == selected
                        val hasEvent = date.toString() in markedDates
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .aspectRatio(1f)
                                .padding(2.dp)
                                .clip(CircleShape)
                                .then(
                                    if (isSelected) {
                                        Modifier.background(MaterialTheme.colorScheme.primary)
                                    } else {
                                        Modifier
                                    },
                                )
                                .clickable { onSelect(date) },
                            contentAlignment = Alignment.Center,
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    "$dayNum",
                                    color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurface,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                )
                                if (hasEvent) {
                                    Box(
                                        modifier = Modifier
                                            .padding(top = 2.dp)
                                            .clip(CircleShape)
                                            .background(
                                                if (isSelected) Color.White
                                                else MaterialTheme.colorScheme.secondary,
                                            )
                                            .padding(2.dp),
                                    )
                                }
                            }
                        }
                    } else {
                        Box(modifier = Modifier.weight(1f).aspectRatio(1f))
                    }
                }
            }
        }
    }
}
