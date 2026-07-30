package com.youngryul.potatobuddy.ui.today

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.youngryul.potatobuddy.data.model.TaskItem
import com.youngryul.potatobuddy.data.repo.TaskRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class TodayUiState(
    val tasks: List<TaskItem> = emptyList(),
    val pendingCompleteIds: Set<String> = emptySet(),
    val isLoading: Boolean = false,
    val error: String? = null,
)

class TodayViewModel(
    private val taskRepository: TaskRepository,
) : ViewModel() {
    private val _ui = MutableStateFlow(TodayUiState())
    val ui: StateFlow<TodayUiState> = _ui.asStateFlow()
    private var completeGeneration = 0

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _ui.update { it.copy(isLoading = true, error = null) }
            try {
                val tasks = taskRepository.fetchTodayTasks()
                _ui.update { it.copy(tasks = tasks, isLoading = false) }
            } catch (e: Exception) {
                _ui.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    fun addTask(title: String) {
        viewModelScope.launch {
            try {
                taskRepository.addTodayTask(title)
                refresh()
            } catch (e: Exception) {
                _ui.update { it.copy(error = e.message) }
            }
        }
    }

    fun togglePendingComplete(id: String) {
        val pending = _ui.value.pendingCompleteIds
        if (id in pending) {
            completeGeneration += 1
            _ui.update { it.copy(pendingCompleteIds = pending - id) }
            return
        }
        val gen = ++completeGeneration
        _ui.update { it.copy(pendingCompleteIds = pending + id) }
        viewModelScope.launch {
            delay(3000)
            if (gen != completeGeneration) return@launch
            if (id !in _ui.value.pendingCompleteIds) return@launch
            try {
                taskRepository.completeTask(id)
                _ui.update {
                    it.copy(
                        tasks = it.tasks.filterNot { t -> t.id == id },
                        pendingCompleteIds = it.pendingCompleteIds - id,
                    )
                }
            } catch (e: Exception) {
                _ui.update {
                    it.copy(
                        pendingCompleteIds = it.pendingCompleteIds - id,
                        error = e.message,
                    )
                }
            }
        }
    }

    fun deleteTask(id: String) {
        viewModelScope.launch {
            try {
                taskRepository.deleteTask(id)
                _ui.update { it.copy(tasks = it.tasks.filterNot { t -> t.id == id }) }
            } catch (e: Exception) {
                _ui.update { it.copy(error = e.message) }
            }
        }
    }

    class Factory(private val repo: TaskRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T = TodayViewModel(repo) as T
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodayScreen(viewModel: TodayViewModel) {
    val state by viewModel.ui.collectAsState()
    var showAdd by remember { mutableStateOf(false) }
    var draft by remember { mutableStateOf("") }

    Scaffold(
        topBar = { TopAppBar(title = { Text("오늘 할일") }) },
        floatingActionButton = {
            FloatingActionButton(onClick = { showAdd = true }) {
                Icon(Icons.Filled.Add, contentDescription = "추가")
            }
        },
    ) { padding ->
        when {
            state.isLoading && state.tasks.isEmpty() -> {
                Column(
                    Modifier.fillMaxSize().padding(padding),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) { CircularProgressIndicator() }
            }
            else -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(padding),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    state.error?.let {
                        item { Text(it, color = MaterialTheme.colorScheme.error) }
                    }
                    if (state.tasks.isEmpty()) {
                        item { Text("오늘 할일이 없습니다. + 버튼으로 추가해 보세요.") }
                    }
                    items(state.tasks, key = { it.id }) { task ->
                        val struck = task.id in state.pendingCompleteIds
                        Card(Modifier = Modifier.fillMaxWidth()) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { viewModel.togglePendingComplete(task.id) }
                                    .padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(
                                    text = task.displayTitle,
                                    modifier = Modifier.weight(1f),
                                    style = MaterialTheme.typography.bodyLarge,
                                    textDecoration = if (struck) TextDecoration.LineThrough else null,
                                    color = if (struck) {
                                        MaterialTheme.colorScheme.onSurfaceVariant
                                    } else {
                                        MaterialTheme.colorScheme.onSurface
                                    },
                                )
                                IconButton(onClick = { viewModel.deleteTask(task.id) }) {
                                    Icon(Icons.Filled.Delete, contentDescription = "삭제")
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAdd) {
        AlertDialog(
            onDismissRequest = { showAdd = false },
            title = { Text("할일 추가") },
            text = {
                OutlinedTextField(
                    value = draft,
                    onValueChange = { draft = it },
                    label = { Text("제목") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (draft.isNotBlank()) {
                            viewModel.addTask(draft)
                            draft = ""
                            showAdd = false
                        }
                    },
                ) { Text("저장") }
            },
            dismissButton = {
                TextButton(onClick = { showAdd = false }) { Text("취소") }
            },
        )
    }
}
