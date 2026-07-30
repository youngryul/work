package com.youngryul.potatobuddy.ui.diary

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.youngryul.potatobuddy.data.model.DiaryItem
import com.youngryul.potatobuddy.data.repo.DiaryRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.YearMonth

data class DiaryUiState(
    val yearMonth: YearMonth = YearMonth.now(),
    val diaries: List<DiaryItem> = emptyList(),
    val editingDate: String? = null,
    val editingContent: String = "",
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val error: String? = null,
)

class DiaryViewModel(
    private val diaryRepository: DiaryRepository,
) : ViewModel() {
    private val _ui = MutableStateFlow(DiaryUiState())
    val ui: StateFlow<DiaryUiState> = _ui.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        val ym = _ui.value.yearMonth
        viewModelScope.launch {
            _ui.update { it.copy(isLoading = true, error = null) }
            try {
                val list = diaryRepository.fetchDiaries(ym.year, ym.monthValue)
                _ui.update { it.copy(diaries = list, isLoading = false) }
            } catch (e: Exception) {
                _ui.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    fun shiftMonth(delta: Long) {
        _ui.update { it.copy(yearMonth = it.yearMonth.plusMonths(delta)) }
        refresh()
    }

    fun openEditor(date: String? = null, content: String = "") {
        val key = date ?: diaryRepository.todayKey()
        viewModelScope.launch {
            val existing = try {
                diaryRepository.fetchDiary(key)
            } catch (_: Exception) {
                null
            }
            _ui.update {
                it.copy(
                    editingDate = key,
                    editingContent = existing?.content ?: content,
                )
            }
        }
    }

    fun onContentChange(value: String) = _ui.update { it.copy(editingContent = value) }

    fun closeEditor() = _ui.update { it.copy(editingDate = null, editingContent = "") }

    fun save() {
        val date = _ui.value.editingDate ?: return
        val content = _ui.value.editingContent
        viewModelScope.launch {
            _ui.update { it.copy(isSaving = true, error = null) }
            try {
                diaryRepository.saveDiary(date, content)
                _ui.update { it.copy(isSaving = false, editingDate = null, editingContent = "") }
                refresh()
            } catch (e: Exception) {
                _ui.update { it.copy(isSaving = false, error = e.message) }
            }
        }
    }

    class Factory(private val repo: DiaryRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T = DiaryViewModel(repo) as T
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DiaryScreen(viewModel: DiaryViewModel) {
    val state by viewModel.ui.collectAsState()

    if (state.editingDate != null) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text(state.editingDate ?: "일기") },
                    navigationIcon = {
                        IconButton(onClick = viewModel::closeEditor) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "뒤로")
                        }
                    },
                    actions = {
                        TextButton(onClick = viewModel::save, enabled = !state.isSaving) {
                            Text(if (state.isSaving) "저장 중" else "저장")
                        }
                    },
                )
            },
        ) { padding ->
            OutlinedTextField(
                value = state.editingContent,
                onValueChange = viewModel::onContentChange,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(16.dp),
                placeholder = { Text("오늘의 기록을 적어보세요") },
            )
        }
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("일기") },
                actions = {
                    IconButton(onClick = { viewModel.openEditor() }) {
                        Icon(Icons.Filled.Edit, contentDescription = "오늘 일기")
                    }
                },
            )
        },
    ) { padding ->
        Column(Modifier = Modifier.fillMaxSize().padding(padding)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                IconButton(onClick = { viewModel.shiftMonth(-1) }) {
                    Icon(Icons.Filled.ChevronLeft, contentDescription = "이전 달")
                }
                Text(
                    "${state.yearMonth.year}년 ${state.yearMonth.monthValue}월",
                    style = MaterialTheme.typography.titleMedium,
                )
                IconButton(onClick = { viewModel.shiftMonth(1) }) {
                    Icon(Icons.Filled.ChevronRight, contentDescription = "다음 달")
                }
            }

            if (state.isLoading) {
                Column(
                    Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) { CircularProgressIndicator() }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    state.error?.let {
                        item { Text(it, color = MaterialTheme.colorScheme.error) }
                    }
                    if (state.diaries.isEmpty()) {
                        item { Text("이번 달 일기가 없습니다.") }
                    }
                    items(state.diaries, key = { it.id }) { diary ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { viewModel.openEditor(diary.date, diary.content) },
                        ) {
                            Column(Modifier = Modifier.padding(14.dp)) {
                                Text(diary.date, style = MaterialTheme.typography.labelLarge)
                                Text(
                                    diary.content.ifBlank { "(내용 없음)" }.take(120),
                                    style = MaterialTheme.typography.bodyMedium,
                                    modifier = Modifier.padding(top = 4.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
